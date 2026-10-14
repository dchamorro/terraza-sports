// Edge Function: approve-guest
//
// POST /functions/v1/approve-guest
//
// Called in two ways:
//   A. Email action button — the URL contains a signed token (booking_id + action + secret)
//   B. Web app — admin clicks Approve/Decline in the admin panel (JWT auth)
//
// Body (JSON):
// {
//   booking_id: string (uuid)
//   action: "approve" | "decline"
//   token?: string   // signed token from email button; omit when calling via JWT
// }
//
// On approve:
//   - booking.status → "confirmed"
//   - slot remains "reserved"
//   - sends confirmation email/push to sponsoring member
//   - for guest bookings: sends guest link email
//
// On decline:
//   - booking.status → "cancelled"
//   - slot.status   → "available"  (via atomic RPC)
//   - no refund (payment hasn't been captured yet at this stage — see payment flow note)
//   - sends decline notification to sponsoring member

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { ok, err, methodNotAllowed } from "../_shared/http.ts";
import { resolveCaller } from "../_shared/auth.ts";
import {
  emailActionSecretConfigured,
  verifyEmailActionToken,
} from "../_shared/email-token.ts";

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method !== "POST") return methodNotAllowed();

  let body: { booking_id?: string; action?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { booking_id, action, token } = body;

  if (!booking_id) return err("booking_id is required", 400);
  if (action !== "approve" && action !== "decline") {
    return err('action must be "approve" or "decline"', 400);
  }

  // ------------------------------------------------------------------
  // Auth: accept either a valid email token OR a JWT from an admin/sports_manager.
  // ------------------------------------------------------------------
  let authorised = false;

  if (token) {
    // Email button path — verify HMAC token, no login required.
    if (!emailActionSecretConfigured()) {
      return err("Email action secret not configured", 500);
    }
    authorised = await verifyEmailActionToken(booking_id, action, token);
    if (!authorised) return err("Invalid or expired approval token", 401);
  } else {
    // Web app path — must be admin or sports_manager.
    const callerResult = await resolveCaller(req.headers.get("Authorization"));
    if ("response" in callerResult) return callerResult.response;
    const { member: caller } = callerResult;

    if (caller.role !== "admin" && caller.role !== "sports_manager") {
      return err("Only admins and the Sports Manager can approve bookings", 403);
    }
    authorised = true;
  }

  if (!authorised) return err("Unauthorised", 401);

  // ------------------------------------------------------------------
  // Load the booking — must be pending_approval.
  // ------------------------------------------------------------------
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, slot_id, member_id, is_guest_booking, guest_email, guest_name, status")
    .eq("id", booking_id)
    .single();

  if (bookingError || !booking) return err("Booking not found", 404);

  if (booking.status !== "pending_approval") {
    return err(
      `Booking is already ${booking.status} — cannot ${action}`,
      409
    );
  }

  // ------------------------------------------------------------------
  // Apply the decision atomically.
  // ------------------------------------------------------------------
  if (action === "approve") {
    const { error: approveError } = await supabaseAdmin
      .from("bookings")
      .update({ status: "confirmed", approved_at: new Date().toISOString() })
      .eq("id", booking_id);

    if (approveError) {
      console.error("Failed to approve booking:", approveError);
      return err("Failed to approve booking", 500);
    }

    // Queue notifications (fire-and-forget).
    queueNotifications(booking_id, booking.member_id, "approved", {
      is_guest: booking.is_guest_booking,
      guest_email: booking.guest_email,
      guest_name: booking.guest_name,
    });

    return ok({ booking_id, status: "confirmed" });
  } else {
    // Decline: cancel booking + release slot atomically via RPC.
    const { error: declineError } = await supabaseAdmin.rpc(
      "decline_booking_atomic",
      { p_booking_id: booking_id }
    );

    if (declineError) {
      console.error("Failed to decline booking:", declineError);
      return err("Failed to decline booking", 500);
    }

    // Queue notification to sponsoring member.
    queueNotifications(booking_id, booking.member_id, "declined", {
      is_guest: booking.is_guest_booking,
    });

    return ok({ booking_id, status: "cancelled" });
  }
});

// ---------------------------------------------------------------------------
// Notification helper (fire-and-forget)
// ---------------------------------------------------------------------------

function queueNotifications(
  bookingId: string,
  memberId: string,
  decision: "approved" | "declined",
  meta: { is_guest: boolean; guest_email?: string | null; guest_name?: string | null }
): void {
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        const rows: Array<{
          type: string;
          payload: Record<string, unknown>;
          channel: "push" | "email";
        }> = [
          {
            type: `booking_${decision}`,
            payload: { booking_id: bookingId, member_id: memberId, ...meta },
            channel: "push",
          },
          {
            type: `booking_${decision}`,
            payload: { booking_id: bookingId, member_id: memberId, ...meta },
            channel: "email",
          },
        ];

        // For approved guest bookings, also send the guest their read-only link.
        if (decision === "approved" && meta.is_guest && meta.guest_email) {
          rows.push({
            type: "guest_reservation_link",
            payload: {
              booking_id: bookingId,
              guest_email: meta.guest_email,
              guest_name: meta.guest_name ?? "",
            },
            channel: "email",
          });
        }

        await supabaseAdmin.from("notification_queue").insert(rows);
      } catch (e) {
        console.error("Failed to queue notifications:", e);
      }
    })()
  );
}

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };
