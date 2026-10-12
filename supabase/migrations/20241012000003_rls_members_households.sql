-- ============================================================
-- RLS Migration 1: helper function + members + households
-- ============================================================

-- ── Helper: get_my_role ──────────────────────────────────────────────────────
-- Returns the app_role for the currently authenticated user.
-- STABLE + SECURITY DEFINER so it runs as the owner (bypasses RLS on members)
-- and its result is cached for the duration of the transaction.
-- Called by every policy below — one lookup per transaction, not per row.

create or replace function get_my_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from members
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- ── Helper: get_my_member_id ─────────────────────────────────────────────────

create or replace function get_my_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from members
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- ── Helper: get_my_household_id ──────────────────────────────────────────────

create or replace function get_my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from members
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- ── members ──────────────────────────────────────────────────────────────────

alter table members enable row level security;

-- Members can read their own row and any member in their household
-- (needed to display household members during booking).
create policy "members_select_own_household" on members
  for select
  using (
    auth.uid() is not null
    and (
      auth_user_id = auth.uid()
      or household_id = get_my_household_id()
      or get_my_role() in ('admin', 'sports_manager', 'committee')
    )
  );

-- No direct INSERT/UPDATE/DELETE from clients.
-- Members are managed by the club sync and admin Edge Functions
-- that run with the service role (bypasses RLS).

-- ── households ───────────────────────────────────────────────────────────────

alter table households enable row level security;

-- Members can read their own household.
create policy "households_select_own" on households
  for select
  using (
    auth.uid() is not null
    and (
      id = get_my_household_id()
      or get_my_role() in ('admin', 'sports_manager', 'committee')
    )
  );

-- No client-side writes — households are managed via service role.
