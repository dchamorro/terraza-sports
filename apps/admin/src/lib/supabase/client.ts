import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Database generic omitted intentionally — see server.ts comment.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
