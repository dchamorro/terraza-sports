// Edge Function: register-device-token
//
// POST /functions/v1/register-device-token
//
// Called by the Flutter app whenever:
//   - The user logs in
//   - FCM refreshes the token (onTokenRefresh callback)
//
// Body (JSON):
// {
//   token:    string   — FCM registration token
//   platform: "ios" | "android"
// }
//
// Behaviour: upserts the token row for this member.
// If the same token was previously registered to a different member
// (device reset / account switch) it is re-assigned to the caller.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { ok, err, methodNotAllowed } from "../_shared/http.ts";
import { resolveCaller } from "../_shared/auth.ts";

serve(async (req: Request) => {
  if (req.method !== "POST") return methodNotAllowed();

  // ── Auth ────────────────────────────────────────────────────────────────────
  const callerResult = await resolveCaller(req.headers.get("Authorization"));
  if ("response" in callerResult) return callerResult.response;
  const { member } = callerResult;

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { token?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { token, platform } = body;
  if (!token?.trim()) return err("token is required", 400);
  if (platform !== "ios" && platform !== "android") {
    return err('platform must be "ios" or "android"', 400);
  }

  // ── Upsert ──────────────────────────────────────────────────────────────────
  // ON CONFLICT on the unique token: re-assign to the current member and
  // update the platform (in case user switched devices).
  const { error: upsertError } = await supabaseAdmin
    .from("device_tokens")
    .upsert(
      {
        member_id: member.id,
        token: token.trim(),
        platform,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "token",        // unique constraint column
        ignoreDuplicates: false,    // always update member_id + platform
      }
    );

  if (upsertError) {
    console.error("Failed to upsert device token:", upsertError);
    return err("Failed to register device token", 500);
  }

  return ok({ registered: true });
});
