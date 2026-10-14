// Shared: signed tokens for email action buttons (Approve / Decline).
//
// Token = base64url( HMAC-SHA256( `${bookingId}:${action}`, EMAIL_ACTION_SECRET ) )
//
// The token is generated when the approval email is rendered (send-notification)
// and verified by approve-guest. Replay is harmless: approve-guest refuses to
// act on a booking that is no longer pending_approval.

const EMAIL_ACTION_SECRET = Deno.env.get("EMAIL_ACTION_SECRET") ?? "";

export function emailActionSecretConfigured(): boolean {
  return EMAIL_ACTION_SECRET.length > 0;
}

async function hmacKey(usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(EMAIL_ACTION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signEmailActionToken(
  bookingId: string,
  action: "approve" | "decline"
): Promise<string> {
  if (!emailActionSecretConfigured()) {
    throw new Error("EMAIL_ACTION_SECRET is not configured");
  }
  const key = await hmacKey(["sign"]);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${bookingId}:${action}`)
  );
  return base64urlEncode(new Uint8Array(sig));
}

export async function verifyEmailActionToken(
  bookingId: string,
  action: string,
  token: string
): Promise<boolean> {
  if (!emailActionSecretConfigured()) return false;
  let sig: Uint8Array<ArrayBuffer>;
  try {
    sig = base64urlDecode(token);
  } catch {
    return false;
  }
  const key = await hmacKey(["verify"]);
  return crypto.subtle.verify(
    "HMAC",
    key,
    sig,
    new TextEncoder().encode(`${bookingId}:${action}`)
  );
}
