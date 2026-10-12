import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  // We intentionally omit the Database generic here.
  // Supabase's auto-generated types require a `Relationships` field on each table
  // that our hand-authored types don't include. Query results are typed explicitly
  // at the call site using our row interfaces from @terraza/types.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only.
            // Middleware handles the refresh.
          }
        },
      },
    }
  );
}
