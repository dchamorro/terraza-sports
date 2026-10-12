// Service-role client — bypasses RLS.
// Only used in Server Actions and Route Handlers, never shipped to the browser.
// Database generic omitted intentionally — see server.ts comment.
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
