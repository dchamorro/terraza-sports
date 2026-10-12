-- ============================================================
-- pg_cron JOBS
-- Run this migration AFTER enabling pg_cron in the Supabase Dashboard:
--   Dashboard → Database → Extensions → search "pg_cron" → Enable
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
        (issued_at < now() - interval '15 days'
          and not exists (select 1 from strikes s2 where s2.member_id = strikes.member_id and s2.offense_type = strikes.offense_type and s2.status = 'active' and s2.issued_at < strikes.issued_at))
        or
        (issued_at < now() - interval '30 days'
          and (select count(*) from strikes s2 where s2.member_id = strikes.member_id and s2.offense_type = strikes.offense_type and s2.status = 'active' and s2.issued_at < strikes.issued_at) = 1)
        or
        (issued_at < now() - interval '45 days'
          and (select count(*) from strikes s2 where s2.member_id = strikes.member_id and s2.offense_type = strikes.offense_type and s2.status = 'active' and s2.issued_at < strikes.issued_at) >= 2)
      );
  $$
);

-- 4. Generate monthly committee report on the 1st of each month at 08:00.
select cron.schedule(
  'monthly-committee-report',
  '0 8 1 * *',
  $$ select pg_notify('committee_report_due', to_char(now(), 'YYYY-MM')); $$
);

-- 5. Release slots for the full rolling 7-day window (runs daily at 00:05).
select cron.schedule(
  'generate-slots',
  '5 0 * * *',
  $$
    insert into slots (resource_id, starts_at, ends_at)
    select r.id, slot_time, slot_time + interval '1 hour'
    from resources r
    cross join generate_series(
      date_trunc('day', now() at time zone 'America/Managua') at time zone 'America/Managua' + interval '11 hours',
      date_trunc('day', now() at time zone 'America/Managua') at time zone 'America/Managua' + interval '7 days' + interval '21 hours',
      interval '1 hour'
    ) as slot_time
    where r.is_active = true
    on conflict (resource_id, starts_at) do nothing;
  $$
);
