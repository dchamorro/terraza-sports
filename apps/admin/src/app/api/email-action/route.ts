export const dynamic = "force-dynamic";
// Route Handler: GET /api/email-action
//
// Called when an admin clicks an Approve or Decline button inside an
// approval email. Because the admin is not logged into the panel at that
// moment, this handler uses a shared secret (EMAIL_ACTION_SECRET) to
// authenticate the action before forwarding it to the approve-guest
// Edge Function via the Supabase service-role key.
//
// Query params:
//   booking_id — UUID of the booking to approve/decline
//   action     — "approve" | "decline"
//
// On success  → 302 redirect to /approvals with a ?success= message
// On error    → 302 redirect to /approvals with an ?error= message

import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EMAIL_ACTION_SECRET = process.env.EMAIL_ACTION_SECRET!;

const ADMIN_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.terrazasports.com";

function redirect(path: string) {
  return NextResponse.redirect(new URL(path, ADMIN_ORIGIN));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("booking_id");
  const action = searchParams.get("action");

  // ── Basic validation ────────────────────────────────────────────────────────
  if (!bookingId || !action) {
    return redirect("/approvals?error=invalid_link");
  }
  if (action !== "approve" && action !== "decline") {
    return redirect("/approvals?error=invalid_action");
  }
  if (!EMAIL_ACTION_SECRET) {
    console.error("EMAIL_ACTION_SECRET is not configured");
    return redirect("/approvals?error=server_misconfiguration");
  }

  // ── Forward to approve-guest Edge Function using service role ──────────────
  // The service-role key is treated as an admin credential here.
  // The Edge Function's resolveCaller() recognises service-role JWTs and
  // grants admin access without a member session.
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/approve-guest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Service-role key acts as the admin auth token for email actions.
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        // Pass the shared secret so the Edge Function can confirm this request
        // originated from the email link, not an arbitrary unauthenticated call.
        "X-Email-Action-Secret": EMAIL_ACTION_SECRET,
      },
      body: JSON.stringify({
        booking_id: bookingId,
        decision: action === "approve" ? "approved" : "declined",
        source: "email_button",
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: string }).error ?? "unknown_error";
      console.error(`approve-guest returned ${res.status}: ${msg}`);
      return redirect(`/approvals?error=${encodeURIComponent(msg)}`);
    }

    const successMsg =
      action === "approve" ? "booking_approved" : "booking_declined";
    return redirect(`/approvals?success=${successMsg}`);
  } catch (e) {
    console.error("email-action handler failed:", e);
    return redirect("/approvals?error=network_error");
  }
}
