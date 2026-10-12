-- ============================================================
-- RLS Migration 3: bookings, booking_addons, charges, refunds,
--                  cancellation_quota
-- ============================================================

-- ── bookings ─────────────────────────────────────────────────────────────────
-- Members can read their own bookings.
-- Admins and sports_manager can read and update all bookings.
-- Committee is read-only (offense log includes booking refs).
-- No direct client INSERT — all creates go through create_booking_atomic RPC
-- (SECURITY DEFINER). No direct client DELETE ever.

alter table bookings enable row level security;

-- SELECT
create policy "bookings_select_own" on bookings
  for select
  using (
    auth.uid() is not null
    and (
      member_id = get_my_member_id()
      or get_my_role() in ('admin', 'sports_manager', 'committee')
    )
  );

-- UPDATE: admins can update (check-in, cancel, approve).
-- Members cannot update their own bookings directly —
-- cancellations go through the cancel_booking_atomic RPC.
create policy "bookings_update_admin" on bookings
  for update
  using (get_my_role() in ('admin', 'sports_manager'))
  with check (get_my_role() in ('admin', 'sports_manager'));

-- ── booking_addons ────────────────────────────────────────────────────────────
-- Members can read add-ons for their own bookings.
-- Admins can read all. No client writes — managed via RPC.

alter table booking_addons enable row level security;

create policy "booking_addons_select_own" on booking_addons
  for select
  using (
    auth.uid() is not null
    and (
      exists (
        select 1 from bookings b
        where b.id = booking_id
          and b.member_id = get_my_member_id()
      )
      or get_my_role() in ('admin', 'sports_manager')
    )
  );

-- ── charges ──────────────────────────────────────────────────────────────────
-- Members can read charges for their own bookings (receipt transparency).
-- Admins can read all. No client writes — managed via RPC and bac-webhook.

alter table charges enable row level security;

create policy "charges_select_own" on charges
  for select
  using (
    auth.uid() is not null
    and (
      exists (
        select 1 from bookings b
        where b.id = booking_id
          and b.member_id = get_my_member_id()
      )
      or get_my_role() in ('admin', 'sports_manager')
    )
  );

-- ── refunds ───────────────────────────────────────────────────────────────────
-- Members can read refunds linked to their own charges.
-- Admins can read all. No client writes.

alter table refunds enable row level security;

create policy "refunds_select_own" on refunds
  for select
  using (
    auth.uid() is not null
    and (
      exists (
        select 1
        from charges c
        join bookings b on b.id = c.booking_id
        where c.id = charge_id
          and b.member_id = get_my_member_id()
      )
      or get_my_role() in ('admin', 'sports_manager')
    )
  );

-- ── cancellation_quota ────────────────────────────────────────────────────────
-- Members can read their own quota (so the app can show remaining free cancellations).
-- Admins and sports_manager can read all.
-- Writes managed by cancel_booking_atomic RPC (SECURITY DEFINER).

alter table cancellation_quota enable row level security;

create policy "cancellation_quota_select_own" on cancellation_quota
  for select
  using (
    auth.uid() is not null
    and (
      member_id = get_my_member_id()
      or get_my_role() in ('admin', 'sports_manager')
    )
  );
