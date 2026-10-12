-- ============================================================
-- RLS Migration 4: strikes, sanctions, abuse_flags
-- ============================================================

-- ── strikes ──────────────────────────────────────────────────────────────────
-- Members can read their own active strikes (so the app can surface warnings).
-- Admins can read and update all strikes (confirm, dismiss).
-- Sports manager can additionally waive strikes (sets status='waived').
-- Committee gets read-only access to the full log (for monthly report).
-- Erased strikes are invisible to members but remain for admins/SM (audit log).

alter table strikes enable row level security;

-- Members see only their own active strikes.
create policy "strikes_select_own_active" on strikes
  for select
  using (
    auth.uid() is not null
    and (
      (
        member_id = get_my_member_id()
        and status = 'active'   -- erased/waived strikes hidden from members
      )
      or get_my_role() in ('admin', 'sports_manager', 'committee')
    )
  );

-- Only sports_manager can waive a strike.
-- Admin/SM can set issued_at (create) and erased_at/waived_at (resolve).
-- Members cannot write strikes directly — issued by Edge Functions + pg_cron.
create policy "strikes_update_sports_manager" on strikes
  for update
  using (get_my_role() in ('admin', 'sports_manager'))
  with check (
    get_my_role() in ('admin', 'sports_manager')
    -- Waiver fields can only be set by sports_manager.
    and (
      waived_at is null
      or get_my_role() = 'sports_manager'
    )
  );

-- ── sanctions ─────────────────────────────────────────────────────────────────
-- Members see their own active sanctions (to know they're blocked).
-- Admins can read all. Sports manager can deactivate (waive).
-- No client INSERT — sanctions are created by the resolve-flag Route Handler
-- via the service-role client.

alter table sanctions enable row level security;

create policy "sanctions_select_own_active" on sanctions
  for select
  using (
    auth.uid() is not null
    and (
      (
        member_id = get_my_member_id()
        and is_active = true
      )
      or get_my_role() in ('admin', 'sports_manager', 'committee')
    )
  );

create policy "sanctions_update_admin" on sanctions
  for update
  using (get_my_role() in ('admin', 'sports_manager'))
  with check (get_my_role() in ('admin', 'sports_manager'));

-- ── abuse_flags ───────────────────────────────────────────────────────────────
-- Members never see abuse flags — these are internal admin records.
-- Admins can read and update (confirm/dismiss).
-- Sports manager can read all.
-- No client INSERT — flags are created by pg_cron / Edge Functions via service role.

alter table abuse_flags enable row level security;

create policy "abuse_flags_select_admin" on abuse_flags
  for select
  using (get_my_role() in ('admin', 'sports_manager'));

create policy "abuse_flags_update_admin" on abuse_flags
  for update
  using (get_my_role() in ('admin', 'sports_manager'))
  with check (get_my_role() in ('admin', 'sports_manager'));
