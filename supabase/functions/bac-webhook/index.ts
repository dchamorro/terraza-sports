// Edge Function: bac-webhook
//
// POST /functions/v1/bac-webhook
//
// Receives payment event callbacks from BAC Credomatic.
// Verifies the webhook signature, then updates charge/refund rows accordingly.
//
// Expected event types (BAC-specific names TBD — pending integration docs):
//   "payment.captured"  → mark charge captured; if booking was pending payment, confirm it
//   "payment.failed"    → mark charge failed; release slot + cancel booking
//   "refund.processed"  → mark refund processed
//   "refund.failed"     → log failure; admin must retry manually
//
// NOTE: BAC Credomatic integration details are pending documentation.
// Signature verification, event payload shape, and SDK calls are stubbed.
// Wire in the real implementation when BAC docs arrive (see ADR-0002).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { ok, err, methodNotAllowed } from "../_shared/http.ts";

// ---------------------------------------------------------------------------
// Signature verification stub
// Replace with BAC Credomatic's actual signature scheme.
// ---------------------------------------------------------------------------

const BAC_WEBHOOK_SECRET = Deno.env.get("BAC_WEBHOOK_SECRET") ?? "";

async function verifyBacSignature(
  body: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!BAC_WEBHOOK_SECRET) {
    // Fail closed. An unverified webhook could cancel any confirmed booking
    // ("payment.failed") or mark charges captured. Set BAC_WEBHOOK_SECRET
    // before exposing this function.
    console.error("[BAC webhook] BAC_WEBHOOK_SECRET not set — rejecting request");
    return false;
  }

  if (!signatureHeader) return false;

  // TODO: replace with BAC's actual signature algorithm once docs arrive.
  // Placeholder: HMAC-SHA256 of raw body with BAC_WEBHOOK_SECRET.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(BAC_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return signatureHeader === expected;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method !== "POST") return methodNotAllowed();

  const rawBody = await req.text();

  // Verify webhook authenticity before processing anything.
  const sigHeader = req.headers.get("x-bac-signature");
  const valid = await verifyBacSignature(rawBody, sigHeader);
  if (!valid) return err("Invalid webhook signature", 401);

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { type, data } = event;

  switch (type) {
    case "payment.captured":
      return handlePaymentCaptured(data);
    case "payment.failed":
      return handlePaymentFailed(data);
    case "refund.processed":
      return handleRefundProcessed(data);
    case "refund.failed":
      return handleRefundFailed(data);
    default:
      // Unknown event — acknowledge receipt so BAC doesn't retry, but log it.
      console.warn(`[BAC webhook] Unknown event type: ${type}`);
      return ok({ received: true });
  }
});

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handlePaymentCaptured(
  data: Record<string, unknown>
): Promise<Response> {
  // Expected fields (TBD — pending BAC docs):
  //   data.transaction_id: string
  //   data.booking_id: string   (sent as metadata when creating the charge)
  //   data.amount: number
  const { transaction_id, booking_id } = data as {
    transaction_id: string;
    booking_id: string;
  };

  if (!transaction_id || !booking_id) {
    return err("Missing transaction_id or booking_id in event data", 400);
  }

  // Mark the charge as captured.
  const { error: chargeError } = await supabaseAdmin
    .from("charges")
    .update({
      bac_transaction_id: transaction_id,
      status: "captured",
      captured_at: new Date().toISOString(),
    })
    .eq("booking_id", booking_id)
    .eq("status", "pending");

  if (chargeError) {
    console.error("Failed to update charge on payment.captured:", chargeError);
    return err("Failed to update charge", 500);
  }

  // If the booking is still pending_approval, leave it — approval is a separate step.
  // If it was somehow left in a holding state, leave it for admin review.

  console.log(`[BAC webhook] Payment captured for booking ${booking_id}`);
  return ok({ received: true });
}

async function handlePaymentFailed(
  data: Record<string, unknown>
): Promise<Response> {
  const { booking_id } = data as { booking_id: string };

  if (!booking_id) return err("Missing booking_id in event data", 400);

  // Payment failed → release slot + cancel booking atomically.
  const { error: rpcError } = await supabaseAdmin.rpc(
    "cancel_booking_atomic",
    { p_booking_id: booking_id, p_will_refund: false }
  );

  if (rpcError) {
    console.error("Failed to cancel booking after payment failure:", rpcError);
    return err("Failed to cancel booking", 500);
  }

  // Mark the charge as failed.
  await supabaseAdmin
    .from("charges")
    .update({ status: "failed" })
    .eq("booking_id", booking_id)
    .eq("status", "pending");

  console.log(`[BAC webhook] Payment failed for booking ${booking_id} — slot released`);
  return ok({ received: true });
}

async function handleRefundProcessed(
  data: Record<string, unknown>
): Promise<Response> {
  const { refund_id, bac_refund_id } = data as {
    refund_id: string;
    bac_refund_id: string;
  };

  if (!refund_id) return err("Missing refund_id in event data", 400);

  const { error } = await supabaseAdmin
    .from("refunds")
    .update({
      bac_refund_id: bac_refund_id ?? null,
      status: "processed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", refund_id)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to update refund on refund.processed:", error);
    return err("Failed to update refund", 500);
  }

  console.log(`[BAC webhook] Refund ${refund_id} processed`);
  return ok({ received: true });
}

async function handleRefundFailed(
  data: Record<string, unknown>
): Promise<Response> {
  const { refund_id } = data as { refund_id: string };

  if (!refund_id) return err("Missing refund_id in event data", 400);

  await supabaseAdmin
    .from("refunds")
    .update({ status: "failed" })
    .eq("id", refund_id);

  // Log for admin — they'll need to retry manually.
  console.error(`[BAC webhook] Refund ${refund_id} FAILED — manual intervention required`);

  return ok({ received: true });
}
