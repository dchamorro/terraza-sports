-- ============================================================
-- Push notifications — device_tokens table + RLS
-- ============================================================

-- Stores FCM registration tokens per member device.
-- A member may have multiple devices (phone + tablet).
-- Tokens are upserted on every app launch; stale tokens are
-- cleaned up when FCM returns a "token not registered" error.

create table device_tokens (
  id          uuid primary key default uuid_generate_v4(),
  member_id   uuid not null references members(id) on delete cascade,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One row per token value (tokens can move between accounts on device reset).
  constraint device_tokens_token_unique unique (token)
);

create index device_tokens_member_idx on device_tokens (member_id);

create trigger device_tokens_updated_at
  before update on device_tokens
  for each row execute function set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table device_tokens enable row level security;

-- Members can read/upsert/delete their own tokens.
create policy "device_tokens_select_own" on device_tokens
  for select
  using (
    auth.uid() is not null
    and member_id = get_my_member_id()
  );

create policy "device_tokens_insert_own" on device_tokens
  for insert
  with check (
    auth.uid() is not null
    and member_id = get_my_member_id()
  );

create policy "device_tokens_update_own" on device_tokens
  for update
  using (member_id = get_my_member_id())
  with check (member_id = get_my_member_id());

create policy "device_tokens_delete_own" on device_tokens
  for delete
  using (member_id = get_my_member_id());

-- Admins/SM can read all (needed for send-notification fan-out).
create policy "device_tokens_select_admin" on device_tokens
  for select
  using (get_my_role() in ('admin', 'sports_manager'));

-- ── Add device_tokens to the Database type exports ───────────────────────────
-- (TypeScript types are hand-authored; add DeviceTokenRow to packages/types
--  when the type file is next regenerated.)
