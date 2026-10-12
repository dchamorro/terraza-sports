-- ============================================================
-- create_booking_atomic
--
-- Called by the create-booking Edge Function.
-- Performs the entire booking write in a single transaction:
--   1. Lock + assert slot is still available
--   2. Mark slot reserved
--   3. Insert booking row
--   4. Insert booking_addon rows
--   5. Mark provider_availability.is_booked for lesson/sparring
--   6. Insert charge row (pending)
--
-- Returns JSON: { booking_id, charge_id }
-- ============================================================

create type addon_input as (
  addon_type            text,
  provider_availability_id uuid,
  price_at_booking_nio  numeric
);

create or replace function create_booking_atomic(
  p_slot_id           uuid,
  p_member_id         uuid,
  p_status            booking_status,
  p_is_guest_booking  boolean,
  p_guest_name        text,
  p_guest_email       text,
  p_total_nio         numeric,
  p_addons            jsonb          -- array of addon_input objects
)
returns jsonb
language plpgsql
security definer  -- runs as the function owner, bypasses RLS inside the tx
as $$
declare
  v_slot_status   slot_status;
  v_booking_id    uuid;
  v_charge_id     uuid;
  v_addon         jsonb;
  v_avail_id      uuid;
begin
  -- ----------------------------------------------------------------
  -- 1. Lock the slot row FOR UPDATE to prevent concurrent double-books.
  -- ----------------------------------------------------------------
  select status into v_slot_status
  from slots
  where id = p_slot_id
  for update;

  if v_slot_status is null then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_slot_status <> 'available' then
    -- Unique-constraint-style code so the Edge Function maps it to 409.
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = '23505';
  end if;

  -- ----------------------------------------------------------------
  -- 2. Mark slot reserved.
  -- ----------------------------------------------------------------
  update slots set status = 'reserved' where id = p_slot_id;

  -- ----------------------------------------------------------------
  -- 3. Insert booking row.
  -- ----------------------------------------------------------------
  insert into bookings (
    slot_id,
    member_id,
    is_guest_booking,
    guest_name,
    guest_email,
    status
  ) values (
    p_slot_id,
    p_member_id,
    p_is_guest_booking,
    p_guest_name,
    p_guest_email,
    p_status
  )
  returning id into v_booking_id;

  -- ----------------------------------------------------------------
  -- 4 & 5. Insert add-ons; lock + mark provider availability.
  -- ----------------------------------------------------------------
  for v_addon in select * from jsonb_array_elements(p_addons)
  loop
    v_avail_id := (v_addon->>'provider_availability_id')::uuid;

    -- For lesson/sparring: assert provider is still available, then lock it.
    if v_avail_id is not null then
      perform 1
      from provider_availability
      where id = v_avail_id
        and is_booked = false
      for update;

      if not found then
        raise exception 'PROVIDER_NOT_AVAILABLE' using errcode = 'P0002';
      end if;

      update provider_availability
      set is_booked = true
      where id = v_avail_id;
    end if;

    insert into booking_addons (
      booking_id,
      addon_type,
      provider_availability_id,
      price_at_booking_nio
    ) values (
      v_booking_id,
      (v_addon->>'addon_type')::addon_type,
      v_avail_id,
      (v_addon->>'price_at_booking_nio')::numeric
    );
  end loop;

  -- ----------------------------------------------------------------
  -- 6. Insert charge row (pending — BAC call happens outside the tx).
  -- ----------------------------------------------------------------
  insert into charges (booking_id, amount_nio)
  values (v_booking_id, p_total_nio)
  returning id into v_charge_id;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'charge_id',  v_charge_id
  );
end;
$$;

-- ============================================================
-- notification_queue table
-- Used by Edge Functions to queue push/email work fire-and-forget.
-- A separate worker (Edge Function on Realtime INSERT) processes rows.
-- ============================================================

create table notification_queue (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null,
  payload     jsonb not null,
  channel     notification_channel not null,
  processed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notification_queue_unprocessed_idx
  on notification_queue (created_at)
  where processed = false;
