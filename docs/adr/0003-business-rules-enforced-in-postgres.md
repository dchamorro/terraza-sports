# Core booking rules enforced in Postgres, not application code

The one-active-booking limit, household peak-hour tennis cap, school-hours block, and cancellation-quota tracking are implemented as Postgres CHECK constraints, triggers, and RLS policies — not solely in Edge Function logic. Application code calls the database; the database refuses invalid states.

This means the rules cannot be accidentally bypassed by a future Edge Function, a direct Supabase dashboard insert, or a migration script. The trade-off is that rule changes require a schema migration (with the doc gate) rather than a code deploy alone — which is intentional: the design doc explicitly requires a CI/CD gate before any booking-logic change can merge.
