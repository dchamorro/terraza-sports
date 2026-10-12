-- ============================================================
-- decline_booking_atomic
--
-- Called by the approve-guest Edge Function on "decline".
-- Cancels the booking and releases the slot in one transaction.
-- No refund row is created — payment was never captured at this stage.
-- ============================================================

create or replace function decline_booking_atomic(
  p_booking_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_slot_id uuid;
begin
  -- Lock the booking row.
  select slot_id into v_slot_id
  from bookings
  where id = p_booking_id
    and status = 'pending_approval'
  for update;

  if not found then
    raise exception 'BOOKING_NOT_PENDING' using errcode = 'P0003';
  end if;

  -- Cancel the booking.
  update bookings
  set status      = 'cancelled',
      cancelled_at = now(),
      cancellation_refund = false
  where id = p_booking_id;

  -- Release the slot.
  update slots
  set status = 'available'
  where id = v_slot_id;

  -- Release any provider availability locked by this booking.
  update provider_availability pa
  set is_booked = false
  from booking_addons ba
  where ba.booking_id = p_booking_id
    and ba.provider_availability_id = pa.id;

  -- Void the pending charge (no payment captured yet).
  update charges
  set status = 'voided'
  where booking_id = p_booking_id
    and status = 'pending';
end;
$$;

-- ============================================================
-- cancel_booking_atomic
--
-- Called by the cancel-booking Edge Function and bac-webhook (on payment.failed).
-- Cancels a confirmed booking, releases the slot, and increments the
-- refund quota counter if a refund is being issued.
--
-- Returns JSON: { charge_id }  (null if no captured charge found)
-- ============================================================

create or replace function cancel_booking_atomic(
  p_booking_id  uuid,
  p_will_refund boolean
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_slot_id    uuid;
  v_charge_id  uuid;
  v_member_id  uuid;
  v_month      date;
begin
  -- Lock the booking row.
  select slot_id, member_id into v_slot_id, v_member_id
  from bookings
  where id = p_booking_id
    and status = 'confirmed'
  for update;

  if not found then
    raise exception 'BOOKING_NOT_CONFIRMED' using errcode = 'P0004';
  end if;

  -- Cancel the booking.
  update bookings
  set status              = 'cancelled',
      cancelled_at        = now(),
      cancellation_refund = p_will_refund
  where id = p_booking_id;

  -- Release the slot.
  update slots
  set status = 'available'
  where id = v_slot_id;

  -- Release any provider availability locked by add-ons.
  update provider_availability pa
  set is_booked = false
  from booking_addons ba
  where ba.booking_id = p_booking_id
    and ba.provider_availability_id = pa.id;

  -- Fetch the captured charge ID (may be null if payment never captured).
  select id into v_charge_id
  from charges
  where booking_id = p_booking_id
    and status = 'captured'
  limit 1;

  -- Increment refund quota if a refund is being issued.
  if p_will_refund then
    v_month := date_trunc('month', now())::date;

    insert into cancellation_quota (member_id, month, refunded_count)
    values (v_member_id, v_month, 1)
    on conflict (member_id, month)
    do update set refunded_count = cancellation_quota.refunded_count + 1;
  end if;

  return jsonb_build_object('charge_id', v_charge_id);
end;
$$;
