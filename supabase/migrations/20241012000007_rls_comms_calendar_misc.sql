-- ============================================================
-- RLS Migration 5: ideas_inbox, news_posts, holiday_calendar,
--                  notification_queue, ad_placements
-- ============================================================

-- ── holiday_calendar ─────────────────────────────────────────────────────────
-- All authenticated users can read (app needs to check whether school-hours
-- block is lifted for a given date).
-- Admin and sports_manager can insert/delete.

alter table holiday_calendar enable row level security;

create policy "holiday_calendar_select_authenticated" on holiday_calendar
  for select
  using (auth.uid() is not null);

create policy "holiday_calendar_write_admin" on holiday_calendar
  for all
  using (get_my_role() in ('admin', 'sports_manager'))
  with check (get_my_role() in ('admin', 'sports_manager'));

-- ── news_posts ────────────────────────────────────────────────────────────────
-- All authenticated users can read published posts.
-- Sports manager and committee can insert/update/delete.

alter table news_posts enable row level security;

create policy "news_posts_select_published" on news_posts
  for select
  using (
    auth.uid() is not null
    and (
      published_at is not null
      or get_my_role() in ('sports_manager', 'committee', 'admin')
    )
  );

create policy "news_posts_write_sm_committee" on news_posts
  for all
  using (get_my_role() in ('sports_manager', 'committee'))
  with check (get_my_role() in ('sports_manager', 'committee'));

-- ── ideas_inbox ───────────────────────────────────────────────────────────────
-- Members can read and insert their own submissions.
-- Admins, sports_manager, and committee can read all and update (triage).
-- No deletes from clients.

alter table ideas_inbox enable row level security;

-- SELECT: members see only their own; privileged roles see all.
create policy "ideas_inbox_select" on ideas_inbox
  for select
  using (
    auth.uid() is not null
    and (
      submitted_by = get_my_member_id()
      or get_my_role() in ('admin', 'sports_manager', 'committee')
    )
  );

-- INSERT: any authenticated member (or privileged role) can submit.
create policy "ideas_inbox_insert_member" on ideas_inbox
  for insert
  with check (
    auth.uid() is not null
    and submitted_by = get_my_member_id()
  );

-- UPDATE (triage): sports_manager only (sets status, triaged_by, triage_note).
create policy "ideas_inbox_update_sports_manager" on ideas_inbox
  for update
  using (get_my_role() = 'sports_manager')
  with check (get_my_role() = 'sports_manager');

-- ── notification_queue ────────────────────────────────────────────────────────
-- Entirely internal — no client reads or writes.
-- All access via service role (Edge Functions, pg_notify worker).

alter table notification_queue enable row level security;

-- No policies created = no access for any authenticated user.
-- Service role bypasses RLS entirely.

-- ── ad_placements ─────────────────────────────────────────────────────────────
-- v1 scaffold — app reads active placements (surface_key lookup).
-- No client writes; sports_manager manages via service role or dashboard.

alter table ad_placements enable row level security;

create policy "ad_placements_select_active" on ad_placements
  for select
  using (
    auth.uid() is not null
    and (
      is_active = true
      or get_my_role() in ('admin', 'sports_manager')
    )
  );
