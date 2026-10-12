// Edge Function: send-notification
//
// Triggered by a Supabase Realtime webhook on notification_queue INSERT.
// Supabase Database Webhooks deliver a POST with a JSON body of shape:
//   { type: "INSERT", table: "notification_queue", record: { ... }, old_record: null, schema: "public" }
//
// The function:
//   1. Reads the new row from the webhook payload.
//   2. Builds the message using notification-templates.ts.
//   3. Dispatches:
//      - channel = "push"  → FCM HTTP v1 API (fan-out to all member device tokens)
//      - channel = "email" → Resend (to member or admin email)
//   4. Marks the row processed = true.
//
// Required environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   FIREBASE_SERVICE_ACCOUNT_JSON  — full Firebase service-account JSON (for FCM v1 auth)
//   RESEND_API_KEY                 — Resend API key
//   EMAIL_FROM                     — sender address, e.g. "Terraza Sports <noreply@terrazasports.com>"
//   ADMIN_EMAIL                    — address that receives admin-facing notifications
//   ADMIN_URL                      — https://admin.terrazasports.com (used in templates)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  — auto-injected by Supabase

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { buildTemplate } from "../_shared/notification-templates.ts";

// ── FCM v1 helper ─────────────────────────────────────────────────────────────

/** base64url-encodes a string (RFC 4648 §5 — no padding, URL-safe chars). */
function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** base64url-encodes a Uint8Array. */
function b64urlBytes(bytes: Uint8Array): string {
  return b64url(String.fromCharCode(...bytes));
}

/** Returns a short-lived OAuth2 access token from a service-account JSON. */
async function getFcmAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")!);

  // JWT header + payload for a Google OAuth2 assertion (must be base64url).
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const signingInput = `${header}.${payload}`;

  // Import the RSA private key.
  const pemKey = sa.private_key as string;
  const pemBody = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${b64urlBytes(new Uint8Array(sigBytes))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`FCM token error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token as string;
}

/** Sends a single FCM message to one device token. Returns false if token is stale. */
async function sendFcmToToken(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string
): Promise<boolean> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          android: { priority: "high" },
          apns: {
            headers: { "apns-priority": "10" },
          },
        },
      }),
    }
  );

  if (res.status === 404) return false; // token unregistered — caller should delete it
  return true;
}

// ── Resend helper ─────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY")!;
  const from = Deno.env.get("EMAIL_FROM") ?? "Terraza Sports <noreply@terrazasports.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

// ── Recipient resolution ──────────────────────────────────────────────────────

/** Returns the email address for a notification recipient. */
async function resolveEmail(
  type: string,
  payload: Record<string, unknown>
): Promise<string | null> {
  // Admin-facing notifications go to the configured admin address.
  if (type === "under12_approval_request" || type === "guest_approval_request") {
    return Deno.env.get("ADMIN_EMAIL") ?? null;
  }

  // Guest link goes directly to the guest.
  if (type === "guest_reservation_link") {
    return (payload.guest_email as string) ?? null;
  }

  // Everything else goes to the member who owns the booking.
  const memberId = payload.member_id as string | undefined;
  if (!memberId) return null;

  const { data } = await supabaseAdmin
    .from("members")
    .select("email")
    .eq("id", memberId)
    .single();

  return (data as { email: string } | null)?.email ?? null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  let rowId: string | undefined;

  try {
    const webhookBody = await req.json();
    // Supabase DB webhook shape: { record: { id, type, payload, channel, processed } }
    const row = webhookBody?.record as {
      id: string;
      type: string;
      payload: Record<string, unknown>;
      channel: "push" | "email";
      processed: boolean;
    } | undefined;

    if (!row?.id) {
      return new Response("No record in payload", { status: 400 });
    }

    // Idempotency guard — skip rows already processed.
    if (row.processed) {
      return new Response("Already processed", { status: 200 });
    }

    rowId = row.id;
    const { type, payload, channel } = row;
    const template = buildTemplate(type, payload);

    if (channel === "push" && template.push) {
      const { title, body } = template.push;
      const memberId = payload.member_id as string | undefined;
      if (memberId) {
        const { data: tokens } = await supabaseAdmin
          .from("device_tokens")
          .select("id, token")
          .eq("member_id", memberId);

        if (tokens && tokens.length > 0) {
          const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")!);
          const accessToken = await getFcmAccessToken();
          const staleIds: string[] = [];

          await Promise.all(
            (tokens as { id: string; token: string }[]).map(async (t) => {
              const ok = await sendFcmToToken(accessToken, sa.project_id, t.token, title, body);
              if (!ok) staleIds.push(t.id);
            })
          );

          // Clean up stale tokens so we don't keep hitting the FCM error.
          if (staleIds.length > 0) {
            await supabaseAdmin
              .from("device_tokens")
              .delete()
              .in("id", staleIds);
          }
        }
      }
    }

    if (channel === "email" && template.email) {
      const { subject, html } = template.email;
      const to = await resolveEmail(type, payload);
      if (to) {
        await sendEmail(to, subject, html);
      }
    }

    // Mark processed.
    await supabaseAdmin
      .from("notification_queue")
      .update({ processed: true })
      .eq("id", rowId);

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("send-notification error:", e);
    // Don't mark as processed on error — it can be retried.
    return new Response("Internal error", { status: 500 });
  }
});
