# Supabase + Postgres as primary datastore and auth provider

The booking rules (household cap, one-active-booking limit, school-hours block, strike escalation) are complex relational constraints that are far easier to enforce at the database level than in application code. We chose Supabase because it gives us managed Postgres with Row Level Security for role enforcement, pg_cron for scheduled jobs (no-show detection, strike erasure, monthly reports), and Realtime for live slot availability — all without running a separate API server. Auth, storage, and Edge Functions are co-located in the same platform, keeping the operational surface small for a team of this size.

## Considered Options

- **PlanetScale (MySQL)** — no CHECK constraints, no RLS, no pg_cron. Ruled out.
- **Firebase Firestore** — document model poorly suited to relational booking rules and reporting queries. Ruled out.
- **Self-hosted Postgres on Fly.io** — more control, but removes managed Auth, Realtime, and Storage; adds ops burden with no clear benefit at this scale. Ruled out.
