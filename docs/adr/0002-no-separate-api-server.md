# No separate API server — Supabase Edge Functions handle all server-side logic

Rather than building and operating a dedicated API server (Node/Express, NestJS, etc.), all server-side orchestration lives in Supabase Edge Functions (Deno). Vercel Route Handlers cover web-specific webhooks (BAC Credomatic payment callbacks, email approval-button callbacks). Both the Flutter app and the Next.js admin panel query Supabase directly using their respective SDKs, with RLS enforcing access control at the database layer.

This removes an entire deployment target and its associated CI pipeline, scaling, and monitoring from the stack. The trade-off is that complex multi-step business logic (e.g. booking creation with payment + add-on validation + anti-abuse checks) must be orchestrated inside a single Edge Function rather than across service boundaries — acceptable given the bounded scope of v1.

## Consequences

Booking creation is a single atomic Edge Function call. If BAC Credomatic's server-side SDK proves incompatible with the Deno runtime, this ADR should be revisited and a thin Node.js webhook worker introduced.
