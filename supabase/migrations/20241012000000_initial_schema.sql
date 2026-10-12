-- ============================================================
-- Terraza Sports — initial schema
-- All times stored in UTC. Application layer converts to
-- America/Managua (UTC-6) for display.
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type resource_type as enum ('tennis_court', 'bowling_lane');

create type slot_status as enum ('available', 'reserved', 'blocked');

create type age_tier as enum ('under_12', 'minor', 'adult');
-- under_12 = <12 | minor = 12-17 | adult = 18+

create type booking_status as enum (
  'pending_approval',   -- under-12 or guest request awaiting admin
  'confirmed',
  'cancelled',
  'no_show',
  'checked_in'
);

create type addon_type as enum (
  'equipment_rental',
  'lesson',
  'sparring',
  'court_lights'
);

create type offense_type as enum (
  'no_show',
  'dependent_swap',
  'account_impersonation',
  'guest_rule_violation'
);

create type strike_status as enum ('active', 'erased', 'waived');

create type sanction_type as enum (
  'warning',
  'block_7d',
  'block_14d',
  'block_30d',
  'block_60d',
  'committee_review'
);

create type ideas_inbox_status as enum (
  'new',
  'under_review',
  'adopted',
  'declined'
);

create type ideas_submitter_role as enum (
  'member',
  'admin',
  'sports_manager',
  'committee'
);

create type notification_channel as enum ('push', 'email');

create type app_role as enum (
  'member',
  'admin',
  'sports_manager',
  'committee',
  'coach',
  'sparring_partner'
);

-- ============================================================
-- MEMBERS & HOUSEHOLDS
-- ============================================================

-- Households group Members and Dependents for the peak-hour cap.
create table households (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Members are synced from the club's external system.
-- auth.users.id is the Supabase Auth UID.
create table members (
  id              uuid primary key default uuid_generate_v4(),
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  household_id    uuid not null references households(id),
  external_ref    text unique,          -- id from the club's member system
  full_name       text not null,
  email           text unique not null,
  phone           text,
  date_of_birth   date,                 -- required for Dependents
  age_tier        age_tier not null default 'adult',
  role            app_role not null default 'member',
  is_dependent    boolean not null default false,
  parent_id       uuid references members(id),   -- set for under-12 + minor
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint dependents_require_parent check (
    is_dependent = false or parent_id is not null
  )
);

-- Recompute age_tier automatically on birthday via pg_cron (see cron section).
-- Trigger to keep updated_at fresh.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger members_updated_at
  before update on members
  for each row execute function set_updated_at();

-- ============================================================
-- RESOURCES (tennis courts, bowling lanes)
-- ============================================================

create table resources (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  resource_type resource_type not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- HOLIDAY CALENDAR
-- Admin-maintained. Dates here lift the school-hours block.
-- ============================================================

create table holiday_calendar (
  id          uuid primary key default uuid_generate_v4(),
  date        date not null unique,
  description text,
  created_by  uuid not null references members(id),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- SLOTS
-- Generated (by Edge Function or pg_cron) for each Resource
-- for every day within the 7-day booking window.
-- One row per resource × date × hour.
-- ============================================================

create table slots (
  id            uuid primary key default uuid_generate_v4(),
  resource_id   uuid not null references resources(id),
  starts_at     timestamptz not null,   -- UTC; always on the hour
  ends_at       timestamptz not null generated always as (starts_at + interval '1 hour') stored,
  status        slot_status not null default 'available',

  constraint slots_resource_starts_unique unique (resource_id, starts_at),
  constraint slots_operating_hours check (
    extract(hour from starts_at at time zone 'America/Managua') >= 5
    and extract(hour from starts_at at time zone 'America/Managua') < 22
  )
);

create index slots_resource_starts_idx on slots (resource_id, starts_at);

-- ============================================================
-- PRICE TABLE
-- Single admin-editable table. Every change is logged.
-- ============================================================

create table price_items (
  id          uuid primary key default uuid_generate_v4(),
  key         text not null unique,   -- e.g. 'tennis_court', 'court_lights', 'lesson'
  label       text not null,
  price_nio   numeric(10,2) not null check (price_nio >= 0),
  is_active   boolean not null default true,
  updated_by  uuid not null references members(id),
  updated_at  timestamptz not null default now()
);

create table price_item_audit (
  id              uuid primary key default uuid_generate_v4(),
  price_item_id   uuid not null references price_items(id),
  old_price_nio   numeric(10,2),
  new_price_nio   numeric(10,2) not null,
  changed_by      uuid not null references members(id),
  changed_at      timestamptz not null default now()
);

-- Trigger: log every price change and fire a notification (handled by Edge Function via Realtime).
create or replace function audit_price_change()
returns trigger language plpgsql as $$
begin
  if old.price_nio is distinct from new.price_nio then
    insert into price_item_audit (price_item_id, old_price_nio, new_price_nio, changed_by)
    values (new.id, old.price_nio, new.price_nio, new.updated_by);
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger price_items_audit
  before update on price_items
  for each row execute function audit_price_change();

-- ============================================================
-- COACH / SPARRING PARTNER AVAILABILITY
-- ============================================================

create table provider_availability (
  id            uuid primary key default uuid_generate_v4(),
  provider_id   uuid not null references members(id),
  slot_id       uuid not null references slots(id),
  addon_type    addon_type not null check (addon_type in ('lesson', 'sparring')),
  is_booked     boolean not null default false,

  constraint provider_availability_unique unique (provider_id, slot_id)
);

-- ============================================================
-- BOOKINGS
-- ============================================================

create table bookings (
  id                  uuid primary key default uuid_generate_v4(),
  slot_id             uuid not null references slots(id),
  member_id           uuid not null references members(id),

  -- For guest bookings: the guest's name + email; member_id is the sponsoring member.
  is_guest_booking    boolean not null default false,
  guest_name          text,
  guest_email         text,

  status              booking_status not null default 'confirmed',
  approved_by         uuid references members(id),   -- admin who approved under-12 or guest
  approved_at         timestamptz,

  -- Check-in
  checked_in_at       timestamptz,
  checked_in_by       uuid references members(id),   -- null = QR self check-in

  -- Cancellation
  cancelled_at        timestamptz,
  cancellation_refund boolean,   -- null until cancelled

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint guest_booking_requires_names check (
    is_guest_booking = false
    or (guest_name is not null and guest_email is not null)
  ),
  constraint cancellation_window check (
    cancelled_at is null
    or cancelled_at < (select starts_at - interval '2 hours' from slots where id = slot_id)
  )
);

create trigger bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- Index for the "one active booking per person" check
create unique index bookings_one_active_per_member
  on bookings (member_id)
  where status in ('pending_approval', 'confirmed');

-- ============================================================
-- ADD-ONS
-- ============================================================

create table booking_addons (
  id                    uuid primary key default uuid_generate_v4(),
  booking_id            uuid not null references bookings(id) on delete cascade,
  addon_type            addon_type not null,
  provider_availability_id uuid references provider_availability(id),  -- for lesson/sparring
  price_at_booking_nio  numeric(10,2) not null,
  created_at            timestamptz not null default now(),

  constraint lesson_sparring_require_provider check (
    addon_type not in ('lesson', 'sparring')
    or provider_availability_id is not null
  ),
  constraint lights_tennis_only check (
    addon_type != 'court_lights'
    or exists (
      select 1
      from bookings b
      join slots s on s.id = b.slot_id
      join resources r on r.id = s.resource_id
      where b.id = booking_id
        and r.resource_type = 'tennis_court'
        and extract(hour from s.starts_at at time zone 'America/Managua') >= 17
    )
  )
);

-- ============================================================
-- CHARGES & REFUNDS
-- ============================================================

create table charges (
  id                  uuid primary key default uuid_generate_v4(),
  booking_id          uuid not null references bookings(id),
  amount_nio          numeric(10,2) not null check (amount_nio > 0),
  bac_transaction_id  text unique,          -- returned by BAC Credomatic
  status              text not null default 'pending',  -- pending | captured | failed
  captured_at         timestamptz,
  created_at          timestamptz not null default now()
);

create table refunds (
  id                  uuid primary key default uuid_generate_v4(),
  charge_id           uuid not null references charges(id),
  amount_nio          numeric(10,2) not null check (amount_nio > 0),
  bac_refund_id       text unique,
  status              text not null default 'pending',  -- pending | processed | failed
  processed_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- Cancellation quota: tracks refunded cancellations per member per calendar month.
create table cancellation_quota (
  id              uuid primary key default uuid_generate_v4(),
  member_id       uuid not null references members(id),
  month           date not null,   -- always first day of the month
  refunded_count  integer not null default 0 check (refunded_count >= 0),

  constraint cancellation_quota_unique unique (member_id, month)
);

-- ============================================================
-- ANTI-ABUSE — STRIKES & SANCTIONS
-- ============================================================

create table strikes (
  id              uuid primary key default uuid_generate_v4(),
  member_id       uuid not null references members(id),
  offense_type    offense_type not null,
  booking_id      uuid references bookings(id),
  status          strike_status not null default 'active',
  issued_at       timestamptz not null default now(),
  erased_at       timestamptz,
  waived_at       timestamptz,
  waived_by       uuid references members(id),   -- sports manager
  waiver_reason   text,

  constraint waiver_requires_reason check (
    waived_at is null or waiver_reason is not null
  )
);

create table sanctions (
  id              uuid primary key default uuid_generate_v4(),
  member_id       uuid not null references members(id),
  offense_type    offense_type not null,
  sanction_type   sanction_type not null,
  strike_id       uuid not null references strikes(id),
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,   -- null for committee_review
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Detected-but-unconfirmed abuse patterns queue (admin must confirm before a strike is issued).
create table abuse_flags (
  id              uuid primary key default uuid_generate_v4(),
  member_id       uuid not null references members(id),
  offense_type    offense_type not null,
  booking_id      uuid references bookings(id),
  related_booking_id uuid references bookings(id),
  detected_at     timestamptz not null default now(),
  confirmed_by    uuid references members(id),
  confirmed_at    timestamptz,
  dismissed_by    uuid references members(id),
  dismissed_at    timestamptz
);

-- ============================================================
-- COMMUNICATION — NEWS FEED
-- ============================================================

create type news_audience as enum ('all', 'tennis', 'bowling');

create table news_posts (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid not null references members(id),
  title       text not null,
  body        text not null,
  audience    news_audience not null default 'all',
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger news_posts_updated_at
  before update on news_posts
  for each row execute function set_updated_at();

-- ============================================================
-- COMMUNICATION — IDEAS INBOX
-- ============================================================

create table ideas_inbox (
  id              uuid primary key default uuid_generate_v4(),
  submitted_by    uuid references members(id),   -- null = anonymous (not allowed in v1)
  submitter_role  ideas_submitter_role not null,
  title           text not null,
  body            text not null,
  status          ideas_inbox_status not null default 'new',
  triaged_by      uuid references members(id),
  triaged_at      timestamptz,
  triage_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger ideas_inbox_updated_at
  before update on ideas_inbox
  for each row execute function set_updated_at();

-- ============================================================
-- AD PLACEMENTS — v1 scaffold only (no content, no logic)
-- ============================================================

create table ad_placements (
  id          uuid primary key default uuid_generate_v4(),
  surface_key text not null unique,   -- e.g. 'home_banner', 'booking_confirm_footer'
  label       text not null,
  is_active   boolean not null default false,  -- off by default until v2
  created_at  timestamptz not null default now()
);

-- ============================================================
-- pg_cron JOBS
-- ============================================================

-- 1. Refresh age tiers at midnight (catches birthday rollovers).
select cron.schedule(
  'refresh-age-tiers',
  '0 0 * * *',
  $$
    update members
    set age_tier =
      case
        when date_of_birth is null then 'adult'
        when age(date_of_birth) < interval '12 years' then 'under_12'
        when age(date_of_birth) < interval '18 years' then 'minor'
        else 'adult'
      end
    where is_dependent = true;
  $$
);

-- 2. Mark no-shows 15 minutes after slot start (runs every 5 minutes).
select cron.schedule(
  'mark-no-shows',
  '*/5 * * * *',
  $$
    update bookings
    set status = 'no_show'
    where status = 'confirmed'
      and checked_in_at is null
      and exists (
        select 1 from slots s
        where s.id = slot_id
          and s.starts_at + interval '15 minutes' < now()
      );
  $$
);

-- 3. Erase expired strikes daily at 01:00.
select cron.schedule(
  'erase-expired-strikes',
  '0 1 * * *',
  $$
    update strikes
    set status = 'erased', erased_at = now()
    where status = 'active'
      and (
        -- 1st strike: erased after 15 days
        (
          issued_at < now() - interval '15 days'
          and not exists (
            select 1 from strikes s2
            where s2.member_id = strikes.member_id
              and s2.offense_type = strikes.offense_type
              and s2.status = 'active'
              and s2.issued_at < strikes.issued_at
          )
        )
        or
        -- 2nd strike: erased after 30 days
        (
          issued_at < now() - interval '30 days'
          and (
            select count(*) from strikes s2
            where s2.member_id = strikes.member_id
              and s2.offense_type = strikes.offense_type
              and s2.status = 'active'
              and s2.issued_at < strikes.issued_at
          ) = 1
        )
        or
        -- 3rd strike: erased after 45 days
        (
          issued_at < now() - interval '45 days'
          and (
            select count(*) from strikes s2
            where s2.member_id = strikes.member_id
              and s2.offense_type = strikes.offense_type
              and s2.status = 'active'
              and s2.issued_at < strikes.issued_at
          ) >= 2
        )
      );
  $$
);

-- 4. Generate monthly committee report on the 1st of each month at 08:00.
-- (Payload assembled and emailed by an Edge Function listening on pg_notify.)
select cron.schedule(
  'monthly-committee-report',
  '0 8 1 * *',
  $$ select pg_notify('committee_report_due', to_char(now(), 'YYYY-MM')); $$
);

-- 5. Release slots for upcoming 7-day window (runs daily at 00:05).
select cron.schedule(
  'generate-slots',
  '5 0 * * *',
  $$
    insert into slots (resource_id, starts_at)
    select r.id, slot_time
    from resources r
    cross join generate_series(
      date_trunc('day', now() + interval '7 days'),
      date_trunc('day', now() + interval '7 days') + interval '16 hours',
      interval '1 hour'
    ) as slot_time(starts_at)
    where r.is_active = true
    on conflict (resource_id, starts_at) do nothing;
  $$
);
