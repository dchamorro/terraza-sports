# Terraza Sports

A country-club sports-facility booking platform — tennis courts & bowling lanes.

## Stack

| Layer | Technology |
|---|---|
| Backend | Supabase (Postgres, Auth, Edge Functions, Realtime) |
| Web Admin | Next.js 15 (App Router) on Vercel |
| Mobile | Flutter (iOS + Android) with Riverpod |
| Styling | Tailwind CSS + shadcn/ui |
| Payments | BAC Credomatic (NIO) |
| Notifications | FCM (push) + Resend (email) |

## Monorepo layout

```
apps/
  admin/      → Next.js admin panel (Vercel)
  mobile/     → Flutter app (iOS + Android)
packages/
  types/      → Shared TypeScript types (DB row types, enums)
  config/     → Shared ESLint / Tailwind / TS config
supabase/
  migrations/ → Postgres migrations (run via Supabase CLI)
  functions/  → Edge Functions (Deno)
docs/
  adr/        → Architecture Decision Records
```

## Getting started

### Prerequisites

- Node.js ≥ 20
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Flutter SDK ≥ 3.x
- pnpm ≥ 9 (or npm workspaces)

### Setup

```bash
# Install JS dependencies
npm install

# Start Supabase locally
supabase start

# Apply migrations
supabase db push

# Start the admin panel
cd apps/admin && npm run dev
```

## Key documents

- [`CONTEXT.md`](./CONTEXT.md) — Ubiquitous language glossary
- [`docs/adr/`](./docs/adr/) — Architecture Decision Records
- [`Country Club Booking App — Design Documents.md`](./Country%20Club%20Booking%20App%20—%20Design%20Documents.md) — Business rules source of truth
- [`supabase/migrations/`](./supabase/migrations/) — Postgres schema
