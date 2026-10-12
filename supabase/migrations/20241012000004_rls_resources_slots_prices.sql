-- ============================================================
-- RLS Migration 2: resources, slots, price_items, price_item_audit,
--                  provider_availability
-- ============================================================

-- ── resources ────────────────────────────────────────────────────────────────
-- All authenticated users can read active resources (needed for the booking UI).
-- Writes are admin/sports_manager only (done via service role in practice,
-- but we add an explicit policy so the admin panel's anon-key client works too).

alter table resources enable row level security;

create policy "resources_select_active" on resources
  for select
  using (
    auth.uid() is not null
    and (
      is_active = true
      or get_my_role() in ('admin', 'sports_manager')
    )
  );

create policy "resources_write_admin" on resources
  for all
  using (get_my_role() in ('admin', 'sports_manager'))
  with check (get_my_role() in ('admin', 'sports_manager'));

-- ── slots ────────────────────────────────────────────────────────────────────
-- All authenticated users can read slots (availability calendar is public to members).
-- Only admins/sports_manager can update slot status directly
-- (members go through the create_booking_atomic RPC which is SECURITY DEFINER).

alter table slots enable row level security;

create policy "slots_select_authenticated" on slots
  for select
  using (auth.uid() is not null);

create policy "slots_write_admin" on slots
  for all
  using (get_my_role() in ('admin', 'sports_manager'))
  with check (get_my_role() in ('admin', 'sports_manager'));

-- ── price_items ───────────────────────────────────────────────────────────────
-- All authenticated users can read active prices (shown in checkout).
-- Only the sports_manager can write.

alter table price_items enable row level security;

create policy "price_items_select_active" on price_items
  for select
  using (
    auth.uid() is not null
    and (
      is_active = true
      or get_my_role() in ('admin', 'sports_manager', 'committee')
    )
  );

create policy "price_items_write_sports_manager" on price_items
  for all
  using (get_my_role() = 'sports_manager')
  with check (get_my_role() = 'sports_manager');

-- ── price_item_audit ──────────────────────────────────────────────────────────
-- Read-only for admin+. Written only by the audit trigger (which runs as the
-- table owner — no client writes needed).

alter table price_item_audit enable row level security;

create policy "price_item_audit_select_admin" on price_item_audit
  for select
  using (get_my_role() in ('admin', 'sports_manager', 'committee'));

-- ── provider_availability ────────────────────────────────────────────────────
-- All authenticated users can read (coaches/sparring partners show in the booking UI).
-- Coaches and sparring partners can INSERT/UPDATE their own rows.
-- Admins/sports_manager can manage all rows.
-- is_booked is set only via the create_booking_atomic RPC (SECURITY DEFINER).

alter table provider_availability enable row level security;

create policy "provider_availability_select_authenticated" on provider_availability
  for select
  using (auth.uid() is not null);

-- Providers manage their own availability.
create policy "provider_availability_insert_own" on provider_availability
  for insert
  with check (
    provider_id = get_my_member_id()
    and get_my_role() in ('coach', 'sparring_partner')
  );

create policy "provider_availability_update_own" on provider_availability
  for update
  using (
    provider_id = get_my_member_id()
    and get_my_role() in ('coach', 'sparring_partner')
  )
  with check (
    provider_id = get_my_member_id()
    -- Providers cannot change is_booked directly; that's set by the RPC.
    and is_booked = (select is_booked from provider_availability where id = provider_availability.id)
  );

create policy "provider_availability_delete_own" on provider_availability
  for delete
  using (
    provider_id = get_my_member_id()
    and get_my_role() in ('coach', 'sparring_partner')
    -- Cannot remove a slot that is already booked.
    and is_booked = false
  );

-- Admins can manage all provider availability.
create policy "provider_availability_admin_all" on provider_availability
  for all
  using (get_my_role() in ('admin', 'sports_manager'))
  with check (get_my_role() in ('admin', 'sports_manager'));
