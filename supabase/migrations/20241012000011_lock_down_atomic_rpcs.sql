-- ============================================================
-- Lock down SECURITY DEFINER booking RPCs.
--
-- create_booking_atomic / cancel_booking_atomic / decline_booking_atomic
-- run as their owner and bypass RLS. Postgres grants EXECUTE on new
-- functions to PUBLIC by default, and Supabase exposes every public-schema
-- function over PostgREST, so any authenticated member could call them
-- directly with arbitrary member_id / slot_id / total and skip every rule
-- enforced in the Edge Functions.
--
-- Only the service role (used by the Edge Functions) may execute them.
-- ============================================================

revoke execute on function create_booking_atomic(uuid, uuid, booking_status, boolean, text, text, numeric, jsonb)
  from public, anon, authenticated;

revoke execute on function cancel_booking_atomic(uuid, boolean)
  from public, anon, authenticated;

revoke execute on function decline_booking_atomic(uuid)
  from public, anon, authenticated;

grant execute on function create_booking_atomic(uuid, uuid, booking_status, boolean, text, text, numeric, jsonb)
  to service_role;

grant execute on function cancel_booking_atomic(uuid, boolean)
  to service_role;

grant execute on function decline_booking_atomic(uuid)
  to service_role;
