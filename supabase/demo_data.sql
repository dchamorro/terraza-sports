-- ============================================================
-- Terraza Sports — demo data (bookings, addons, charges,
-- strikes, abuse flags, ideas, holidays)
-- Run after seed.sql.
-- ============================================================

-- ── Helpers ───────────────────────────────────────────────────────────────────
-- Grab a handful of real slot IDs to attach bookings to.

do $$
declare
  -- Members
  m_danilo  uuid := '00000000-0000-0000-0001-000000000001';
  m_edmundo uuid := '00000000-0000-0000-0001-000000000002';
  m_carlos  uuid := '00000000-0000-0000-0001-000000000003';
  m_sofia   uuid := '00000000-0000-0000-0001-000000000004';

  -- Resources
  r_cancha1 uuid := '00000000-0000-0000-0002-000000000001';
  r_cancha2 uuid := '00000000-0000-0000-0002-000000000002';
  r_pista1  uuid := '00000000-0000-0000-0002-000000000004';

  -- Slots (past — already happened so bookings make sense)
  s_past1   uuid;
  s_past2   uuid;
  s_past3   uuid;
  s_past4   uuid;

  -- Slots (future — for upcoming / pending bookings)
  s_future1 uuid;
  s_future2 uuid;
  s_future3 uuid;

  -- Booking IDs
  b1 uuid := gen_random_uuid();
  b2 uuid := gen_random_uuid();
  b3 uuid := gen_random_uuid();
  b4 uuid := gen_random_uuid();
  b5 uuid := gen_random_uuid();
  b6 uuid := gen_random_uuid();
  b7 uuid := gen_random_uuid();

  -- Charge IDs
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
  c4 uuid := gen_random_uuid();
  c5 uuid := gen_random_uuid();

  -- Price item IDs
  p_tennis    uuid := '00000000-0000-0000-0003-000000000001';
  p_bowling   uuid := '00000000-0000-0000-0003-000000000002';
  p_lights    uuid := '00000000-0000-0000-0003-000000000003';
  p_equipment uuid := '00000000-0000-0000-0003-000000000004';

begin

  -- ── Insert past slots at fixed UTC hours (13:00 = 07:00 Managua, 00:00 = 18:00 Managua) ──
  -- yesterday 07:00 Managua = yesterday 13:00 UTC
  -- yesterday 18:00 Managua = today    00:00 UTC
  -- two days ago 09:00 Managua = two days ago 15:00 UTC
  -- two days ago 17:00 Managua = two days ago 23:00 UTC
  insert into slots (id, resource_id, starts_at, ends_at, status) values
    (gen_random_uuid(), r_cancha1,
      (current_date - 1)::timestamptz + interval '13 hours',
      (current_date - 1)::timestamptz + interval '14 hours', 'reserved'),
    (gen_random_uuid(), r_cancha2,
      current_date::timestamptz + interval '0 hours',
      current_date::timestamptz + interval '1 hour',  'reserved'),
    (gen_random_uuid(), r_pista1,
      (current_date - 2)::timestamptz + interval '15 hours',
      (current_date - 2)::timestamptz + interval '16 hours', 'reserved'),
    (gen_random_uuid(), r_cancha1,
      (current_date - 2)::timestamptz + interval '23 hours',
      (current_date - 1)::timestamptz + interval '0 hours',  'reserved')
  on conflict (resource_id, starts_at) do nothing;

  -- Fetch their IDs
  select id into s_past1 from slots where resource_id = r_cancha1
    and starts_at = (current_date - 1)::timestamptz + interval '13 hours' limit 1;
  select id into s_past2 from slots where resource_id = r_cancha2
    and starts_at = current_date::timestamptz + interval '0 hours' limit 1;
  select id into s_past3 from slots where resource_id = r_pista1
    and starts_at = (current_date - 2)::timestamptz + interval '15 hours' limit 1;
  select id into s_past4 from slots where resource_id = r_cancha1
    and starts_at = (current_date - 2)::timestamptz + interval '23 hours' limit 1;

  -- Future slots — pick the next available slot for each resource tomorrow
  select id into s_future1 from slots where resource_id = r_cancha1
    and status = 'available' and starts_at > now() order by starts_at limit 1;
  select id into s_future2 from slots where resource_id = r_cancha2
    and status = 'available' and starts_at > now() order by starts_at limit 1;
  select id into s_future3 from slots where resource_id = r_pista1
    and status = 'available' and starts_at > now() order by starts_at limit 1;

  -- ── Bookings ─────────────────────────────────────────────────────────────────

  -- 1. Carlos — checked in yesterday morning tennis (Cancha 1)
  insert into bookings (id, slot_id, member_id, status, checked_in_at, checked_in_by, created_at) values
    (b1, s_past1, m_carlos, 'checked_in', now() - interval '1 day' + interval '7 hours', null, now() - interval '1 day' - interval '2 hours');

  -- 2. Sofía — no-show yesterday evening tennis (Cancha 2)
  insert into bookings (id, slot_id, member_id, status, created_at) values
    (b2, s_past2, m_sofia, 'no_show', now() - interval '1 day' - interval '3 hours');

  -- 3. Carlos — checked in bowling two days ago
  insert into bookings (id, slot_id, member_id, status, checked_in_at, created_at) values
    (b3, s_past3, m_carlos, 'checked_in', now() - interval '2 days' + interval '9 hours', now() - interval '2 days' - interval '1 hour');

  -- 4. Carlos — cancelled two days ago evening tennis
  insert into bookings (id, slot_id, member_id, status, cancelled_at, cancellation_refund, created_at) values
    (b4, s_past4, m_carlos, 'cancelled', now() - interval '2 days' + interval '14 hours', true, now() - interval '2 days' - interval '4 hours');

  -- 5. Carlos — confirmed upcoming tennis tomorrow morning
  if s_future1 is not null then
    insert into bookings (id, slot_id, member_id, status, created_at) values
      (b5, s_future1, m_carlos, 'confirmed', now() - interval '2 hours');
    update slots set status = 'reserved' where id = s_future1;
  end if;

  -- 6. Sofía — confirmed upcoming tennis tomorrow afternoon
  if s_future2 is not null then
    insert into bookings (id, slot_id, member_id, status, created_at) values
      (b6, s_future2, m_sofia, 'confirmed', now() - interval '1 hour');
    update slots set status = 'reserved' where id = s_future2;
  end if;

  -- 7. Edmundo — pending approval guest booking (bowling)
  if s_future3 is not null then
    insert into bookings (id, slot_id, member_id, status, is_guest_booking, guest_name, guest_email, created_at) values
      (b7, s_future3, m_edmundo, 'pending_approval', true, 'Roberto Vargas', 'roberto@example.com', now() - interval '30 minutes');
    update slots set status = 'reserved' where id = s_future3;
  end if;

  -- ── Booking add-ons ────────────────────────────────────────────────────────

  -- Carlos's checked-in tennis had court lights + equipment rental
  insert into booking_addons (booking_id, addon_type, price_at_booking_nio) values
    (b1, 'court_lights',     80.00),
    (b1, 'equipment_rental', 120.00);

  -- Carlos's upcoming tennis has equipment rental
  if s_future1 is not null then
    insert into booking_addons (booking_id, addon_type, price_at_booking_nio) values
      (b5, 'equipment_rental', 120.00);
  end if;

  -- ── Charges ───────────────────────────────────────────────────────────────

  insert into charges (id, booking_id, amount_nio, status, created_at) values
    (c1, b1, 550.00, 'captured', now() - interval '1 day' - interval '2 hours'),
    (c2, b2, 350.00, 'captured', now() - interval '1 day' - interval '3 hours'),
    (c3, b3, 250.00, 'captured', now() - interval '2 days' - interval '1 hour'),
    (c4, b4, 350.00, 'captured', now() - interval '2 days' - interval '4 hours'),
    (c5, b5, 470.00, 'captured', now() - interval '2 hours');

  -- Refund for Carlos's cancelled booking
  insert into refunds (charge_id, amount_nio, status, processed_at) values
    (c4, 350.00, 'processed', now() - interval '2 days' + interval '15 hours');

  -- ── Strikes ───────────────────────────────────────────────────────────────

  -- Sofía's no-show generates a strike
  insert into strikes (id, member_id, offense_type, booking_id, status, issued_at) values
    (gen_random_uuid(), m_sofia, 'no_show', b2, 'active', now() - interval '1 day' + interval '7 hours' + interval '15 minutes');

  -- Carlos had a strike from a week ago (already erased / expired)
  insert into strikes (id, member_id, offense_type, booking_id, status, issued_at, erased_at) values
    (gen_random_uuid(), m_carlos, 'no_show', null, 'erased', now() - interval '7 days', now() - interval '2 days');

  -- ── Abuse flags ───────────────────────────────────────────────────────────

  -- Unconfirmed flag on Sofía — detected dependent swap
  insert into abuse_flags (member_id, offense_type, booking_id, detected_at) values
    (m_sofia, 'dependent_swap', b2, now() - interval '23 hours');

  -- ── Ideas inbox ───────────────────────────────────────────────────────────

  insert into ideas_inbox (submitted_by, submitter_role, title, body, status) values
    (m_carlos, 'member',
     'Torneos mensuales de tenis',
     'Sería genial organizar un torneo interno mensual. Podría aumentar la participación de los miembros.',
     'new'),
    (m_sofia, 'member',
     'App para reservar equipos de boliche',
     'Actualmente hay que llamar para reservar zapatos. ¿Se puede hacer desde la app?',
     'under_review'),
    (m_edmundo, 'sports_manager',
     'Clases grupales de tenis los sábados',
     'Propongo abrir clases grupales los sábados en la mañana para menores.',
     'adopted');

  -- ── Holiday calendar ──────────────────────────────────────────────────────

  insert into holiday_calendar (date, description, created_by) values
    (current_date + 7,  'Vacaciones de media semana', m_edmundo),
    (current_date + 14, 'Día de la Independencia',    m_edmundo),
    (current_date + 21, 'Vacaciones de fin de año',   m_edmundo)
  on conflict (date) do nothing;

end;
$$;
