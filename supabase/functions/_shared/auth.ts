// Shared: resolve the calling Member from a Supabase JWT.
// Returns the member row or throws with an HTTP 401/403 response.

import { supabaseAdmin } from "./supabase-admin.ts";
import { err } from "./http.ts";

export interface CallerMember {
  id: string;
  household_id: string;
  age_tier: "under_12" | "minor" | "adult";
  is_dependent: boolean;
  parent_id: string | null;
  role: string;
  is_active: boolean;
}

export async function resolveCaller(
  authHeader: string | null
): Promise<{ member: CallerMember } | { response: Response }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: err("Missing authorization header", 401) };
  }

  const token = authHeader.slice(7);

  // Verify the JWT and get the Supabase auth user.
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return { response: err("Invalid or expired token", 401) };
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select(
      "id, household_id, age_tier, is_dependent, parent_id, role, is_active"
    )
    .eq("auth_user_id", user.id)
    .single();

  if (memberError || !member) {
    return { response: err("Member account not found", 403) };
  }

  if (!member.is_active) {
    return { response: err("Member account is inactive", 403) };
  }

  return { member: member as CallerMember };
}
