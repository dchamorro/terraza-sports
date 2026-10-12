-- ============================================================
-- Terraza Sports — demo seed
-- Run with: supabase db push --yes  (applies after migrations)
-- Or paste directly in the SQL Editor.
--
-- Creates:
--   • 2 households
--   • 4 members (admin, sports_manager, 2 regular members)
--   • 3 tennis courts + 4 bowling lanes
--   • 6 price items
--   • slots for today through today+7 (all resources, 05:00–21:00 Managua)
--
-- Auth users are NOT created here — Supabase Auth requires the Dashboard
-- or the admin API. After running this seed, create auth users manually
-- and run the UPDATE at the bottom to link auth_user_id.
-- ============================================================

-- ── Households ────────────────────────────────────────────────────────────────

insert into households (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Familia Chamorro'),
  ('00000000-0000-0000-0000-000000000002', 'Familia Pérez')
on conflict (id) do nothing;

-- ── Members ───────────────────────────────────────────────────────────────────
-- auth_user_id is null until you link real Supabase Auth accounts below.

insert into members (id, household_id, full_name, email, role, age_tier, is_dependent) values
  ('00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Danilo Chamorro', 'danilo@terrazasports.com', 'admin', 'adult', false),

  ('00000000-0000-0000-0001-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Edmundo Sports', 'edmundo@terrazasports.com', 'sports_manager', 'adult', false),

  ('00000000-0000-0000-0001-000000000003',
   '00000000-0000-0000-0000-000000000002',
   'Carlos Pérez', 'carlos@example.com', 'member', 'adult', false),

  ('00000000-0000-0000-0001-000000000004',
   '00000000-0000-0000-0000-000000000002',
   'Sofía Pérez', 'sofia@example.com', 'member', 'adult', false)
on conflict (id) do nothing;

-- ── Resources ─────────────────────────────────────────────────────────────────

insert into resources (id, name, resource_type) values
  ('00000000-0000-0000-0002-000000000001', 'Cancha 1', 'tennis_court'),
  ('00000000-0000-0000-0002-000000000002', 'Cancha 2', 'tennis_court'),
  ('00000000-0000-0000-0002-000000000003', 'Cancha 3', 'tennis_court'),
  ('00000000-0000-0000-0002-000000000004', 'Pista 1',  'bowling_lane'),
  ('00000000-0000-0000-0002-000000000005', 'Pista 2',  'bowling_lane'),
  ('00000000-0000-0000-0002-000000000006', 'Pista 3',  'bowling_lane'),
  ('00000000-0000-0000-0002-000000000007', 'Pista 4',  'bowling_lane')
on conflict (id) do nothing;

-- ── Price items ───────────────────────────────────────────────────────────────
-- updated_by references the admin member.

insert into price_items (id, key, label, price_nio, updated_by) values
  ('00000000-0000-0000-0003-000000000001', 'tennis_court',     'Cancha de tenis (1 hora)',      350.00, '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0003-000000000002', 'bowling_lane',     'Pista de boliche (1 hora)',     250.00, '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0003-000000000003', 'court_lights',     'Iluminación de cancha',          80.00, '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0003-000000000004', 'equipment_rental', 'Alquiler de equipo',            120.00, '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0003-000000000005', 'lesson',           'Clase con entrenador',          500.00, '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0003-000000000006', 'sparring',         'Sparring partner',              200.00, '00000000-0000-0000-0001-000000000001')
on conflict (id) do nothing;

-- ── Slots ─────────────────────────────────────────────────────────────────────
-- Generates slots for every active resource for today through today+7.
-- Operating hours: 05:00–21:00 Managua (UTC-6) = 11:00–03:00 UTC next day.
-- We generate each hour from UTC 11 through UTC 03 (17 slots) per day.

do $$
declare
  v_day       date;
  v_hour      int;
  v_starts_at timestamptz;
  v_resource  record;
begin
  for v_day in
    select generate_series(
      current_date,
      current_date + interval '7 days',
      interval '1 day'
    )::date
  loop
    for v_hour in 0..16 loop  -- 17 slots: hours 0-16 offset from 11:00 UTC = 11,12,...,03 next day
      v_starts_at := (v_day::text || ' 11:00:00+00')::timestamptz + (v_hour || ' hours')::interval;
      for v_resource in select id from resources where is_active = true loop
        insert into slots (resource_id, starts_at, ends_at)
        values (v_resource.id, v_starts_at, v_starts_at + interval '1 hour')
        on conflict (resource_id, starts_at) do nothing;
      end loop;
    end loop;
  end loop;
end;
$$;

-- ============================================================
-- AFTER RUNNING THIS SEED:
--
-- 1. Create auth users in Supabase Dashboard → Authentication → Users:
--      danilo@terrazasports.com      (password of your choice)
--      edmundo@terrazasports.com     (password of your choice)
--      carlos@example.com            (password of your choice)
--      sofia@example.com             (password of your choice)
--
-- 2. Copy each user's UUID from the Auth table and run:
--
--    update members set auth_user_id = '<UUID>' where email = 'danilo@terrazasports.com';
--    update members set auth_user_id = '<UUID>' where email = 'edmundo@terrazasports.com';
--    update members set auth_user_id = '<UUID>' where email = 'carlos@example.com';
--    update members set auth_user_id = '<UUID>' where email = 'sofia@example.com';
--
-- 3. Log in as carlos@example.com or sofia@example.com in the Flutter app
--    to test the member booking flow.
--    Log in as danilo@terrazasports.com in the admin panel.
-- ============================================================
