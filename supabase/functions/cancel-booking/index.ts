// Edge Function: cancel-booking
//
// POST /functions/v1/cancel-booking
//
// Body (JSON):
// {
//   booking_id: string (uuid)
// }
//
// Rules enforced:
//   - Caller must own the booking (or be admin/sports_manager cancelling on behalf)
//   - Booking must be in status "confirmed" (pending_approval cancels are just declines)
//   - Cannot cancel less than 2 hours before slot start
//   - Refund quota: first 2 cancellations per calendar month → refund; 3rd+ → no refund
//
// Flow:
//   1. Auth
//   2. Load + authorise booking
//   3. 2-hour window check
//   4. Refund quota check
//   5. Atomic DB write (cancel-booking RPC): cancel booking, release slot, add-ons cleanup
//   6. Issue refund via BAC if quota allows (stub until BAC docs arrive)
//   7. Queue notification
//   8. Return

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { ok, err, methodNotAllowed } from "../_shared/http.ts";
import { resolveCaller } from "../_shared/auth.ts";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

serve(async (req: Request) => {
  if (req.method !== "POST") return methodNotAllowed();

  // ------------------------------------------------------------------
  // 1. Auth
  // ------------------------------------------------------------------
  const callerResult = await resolveCaller(req.headers.get("Authorization"));
  if ("response" in callerResult) return callerResult.response;
  const { member: caller } = callerResult;

  // ------------------------------------------------------------------
  // 2. Parse body
  // ------------------------------------------------------------------
  let body: { booking_id?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { booking_id } = body;
  if (!booking_id) return err("booking_id is required", 400);

  // ------------------------------------------------------------------
  // 3. Load booking + slot
  // ------------------------------------------------------------------
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      `id, member_id, status, slot_id,
       slots!inner(starts_at)`
    )
    .eq("id", booking_id)
    .single();

  if (bookingError || !booking) return err("Booking not found", 404);

  // Authorise: caller must own the booking, or be admin/sports_manager.
  const isOwner = booking.member_id === caller.id;
  const isAdmin =
    caller.role === "admin" || caller.role === "sports_manager";

  if (!isOwner && !isAdmin) {
    return err("You can only cancel your own bookings", 403);
  }

  if (booking.status !== "confirmed") {
    return err(
      `Booking cannot be cancelled — current status: ${booking.status}`,
      409
    );
  }

  // ------------------------------------------------------------------
  // 4. 2-hour window check
  // ------------------------------------------------------------------
  const slotStart = new Date((booking.slots as { starts_at: string }).starts_at);
  const now = new Date();

  if (slotStart.getTime() - now.getTime() < TWO_HOURS_MS) {
    return err(
      "Bookings cannot be cancelled less than 2 hours before start",
      422
    );
  }

  // ------------------------------------------------------------------
  // 5. Refund quota check
  // ------------------------------------------------------------------
  // The quota is per member_id (the account holder), per calendar month.
  const effectiveMemberId = booking.member_id; // could differ from caller if admin cancel
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const { data: quota } = await supabaseAdmin
    .from("cancellation_quota")
    .select("id, refunded_count")
    .eq("member_id", effectiveMemberId)
    .eq("month", monthStart)
    .maybeSingle();

  const refundedSoFar = quota?.refunded_count ?? 0;
  const willRefund = refundedSoFar < 2;

  // ------------------------------------------------------------------
  // 6. Atomic DB write: cancel booking + release slot
  // ------------------------------------------------------------------
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    "cancel_booking_atomic",
    {
      p_booking_id: booking_id,
      p_will_refund: willRefund,
    }
  );

  if (rpcError) {
    console.error("cancel_booking_atomic failed:", rpcError);
    return err("Failed to cancel booking", 500);
  }

  const { charge_id } = rpcResult as { charge_id: string | null };

  // ------------------------------------------------------------------
  // 7. Issue refund via BAC (stub — real call when BAC docs arrive)
  // ------------------------------------------------------------------
  let refundId: string | null = null;
  if (willRefund && charge_id) {
    refundId = await issueRefundStub(charge_id, booking_id);
  }

  // ------------------------------------------------------------------
  // 8. Queue notification (fire-and-forget)
  // ------------------------------------------------------------------
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        await supabaseAdmin.from("notification_queue").insert({
          type: "booking_cancelled",
          payload: {
            booking_id,
            member_id: effectiveMemberId,
            refunded: willRefund,
            refund_id: refundId,
          },
          channel: "push",
        });
      } catch (e) {
        console.error("Failed to queue notification:", e);
      }
    })()
  );

  // ------------------------------------------------------------------
  // 9. Return
  // ------------------------------------------------------------------
  return ok({
    booking_id,
    status: "cancelled",
    refunded: willRefund,
    refunds_remaining_this_month: willRefund ? Math.max(0, 1 - refundedSoFar) : 0,
  });
});

// ---------------------------------------------------------------------------
// BAC refund stub
// Replace with real BAC Credomatic SDK call once docs arrive.
// Inserts a pending refund row; bac-webhook will mark it processed on callback.
// ---------------------------------------------------------------------------
async function issueRefundStub(
  chargeId: string,
  bookingId: string
): Promise<string | null> {
  try {
    // Fetch the original charge amount.
    const { data: charge } = await supabaseAdmin
      .from("charges")
      .select("id, amount_nio, bac_transaction_id")
      .eq("id", chargeId)
      .maybeSingle();

    if (!charge || charge.status === "pending") {
      // Charge was never captured — no refund needed, just clear it.
      await supabaseAdmin
        .from("charges")
        .update({ status: "voided" })
        .eq("id", chargeId);
      return null;
    }

    const { data: refundRow, error } = await supabaseAdmin
      .from("refunds")
      .insert({
        charge_id: chargeId,
        amount_nio: charge.amount_nio,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to insert refund row:", error);
      return null;
    }

    // TODO: call BAC Credomatic refund API with charge.bac_transaction_id
    // and update refund row status + bac_refund_id on success.
    console.log(
      `[BAC stub] Refund pending for booking ${bookingId}, charge ${chargeId}`
    );

    return refundRow.id;
  } catch (e) {
    console.error("issueRefundStub failed:", e);
    return null;
  }
}

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };
