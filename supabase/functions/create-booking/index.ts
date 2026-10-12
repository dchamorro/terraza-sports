// Edge Function: create-booking
//
// POST /functions/v1/create-booking
//
// Body (JSON):
// {
//   slot_id: string (uuid)
//   addons?: Array<{
//     addon_type: "equipment_rental" | "lesson" | "sparring" | "court_lights"
//     provider_availability_id?: string  // required for lesson + sparring
//   }>
//   // Guest booking — only when booking on behalf of a guest:
//   guest_name?: string
//   guest_email?: string
// }
//
// Flow:
//   1. Auth — resolve calling member from JWT
//   2. Parse + validate request body
//   3. Load slot — must exist, be available, within 7-day window
//   4. Load resource — determines tennis vs bowling rules
//   5. Sanctions check — no active booking block on caller
//   6. One-active-booking check
//   7. Age-tier rules (under-12 → pending_approval; minor school-hours block)
//   8. Guest rules (→ pending_approval, one pending guest per sponsor)
//   9. Household peak-hour tennis cap (tennis + peak hour only)
//  10. Sparring 12-hour window
//  11. Court lights eligibility
//  12. Price computation from price_items table
//  13. Atomic DB write: slot → reserved, booking row, add-on rows, charge row
//  14. Trigger notification (email/push) — fire-and-forget
//  15. Return booking_id + total_nio

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { ok, err, methodNotAllowed } from "../_shared/http.ts";
import { resolveCaller } from "../_shared/auth.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddonRequest {
  addon_type: "equipment_rental" | "lesson" | "sparring" | "court_lights";
  provider_availability_id?: string;
}

interface CreateBookingRequest {
  slot_id: string;
  addons?: AddonRequest[];
  guest_name?: string;
  guest_email?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MANAGUA_OFFSET_HOURS = -6; // UTC-6, no DST

/** Convert a UTC timestamptz string to the local hour in Managua (0–23). */
function managuaHour(utcIso: string): number {
  const utcMs = new Date(utcIso).getTime();
  return new Date(utcMs + MANAGUA_OFFSET_HOURS * 60 * 60 * 1000).getUTCHours();
}

/** Return true if the UTC timestamp falls on a weekday (Mon–Fri). */
function isWeekday(utcIso: string): boolean {
  const utcMs = new Date(utcIso).getTime();
  const localDay = new Date(
    utcMs + MANAGUA_OFFSET_HOURS * 60 * 60 * 1000
  ).getUTCDay(); // 0=Sun, 6=Sat
  return localDay >= 1 && localDay <= 5;
}

/** Return true if hour is in a peak window: 6–7 or 17–18 (i.e. slots starting at 6,7,17,18). */
function isPeakHour(hour: number): boolean {
  return (hour >= 6 && hour < 8) || (hour >= 17 && hour < 19);
}

/** Return "YYYY-MM-DD" in Managua local time for a given UTC ISO string. */
function managuaDateString(utcIso: string): string {
  const utcMs = new Date(utcIso).getTime();
  const local = new Date(utcMs + MANAGUA_OFFSET_HOURS * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method !== "POST") return methodNotAllowed();

  // ------------------------------------------------------------------
  // 1. Auth
  // ------------------------------------------------------------------
  const callerResult = await resolveCaller(req.headers.get("Authorization"));
  if ("response" in callerResult) return callerResult.response;
  const { member: caller } = callerResult;

  // ------------------------------------------------------------------
  // 2. Parse + validate request body
  // ------------------------------------------------------------------
  let body: CreateBookingRequest;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { slot_id, addons = [], guest_name, guest_email } = body;

  if (!slot_id) return err("slot_id is required", 400);

  const isGuestBooking = Boolean(guest_name || guest_email);
  if (isGuestBooking && (!guest_name || !guest_email)) {
    return err("guest_name and guest_email are both required for guest bookings", 400);
  }

  // Validate addon shapes
  const validAddonTypes = ["equipment_rental", "lesson", "sparring", "court_lights"];
  for (const addon of addons) {
    if (!validAddonTypes.includes(addon.addon_type)) {
      return err(`Unknown addon_type: ${addon.addon_type}`, 400);
    }
    if (
      (addon.addon_type === "lesson" || addon.addon_type === "sparring") &&
      !addon.provider_availability_id
    ) {
      return err(`provider_availability_id is required for ${addon.addon_type}`, 400);
    }
  }

  // ------------------------------------------------------------------
  // 3. Load slot
  // ------------------------------------------------------------------
  const { data: slot, error: slotError } = await supabaseAdmin
    .from("slots")
    .select("id, resource_id, starts_at, status")
    .eq("id", slot_id)
    .single();

  if (slotError || !slot) return err("Slot not found", 404);
  if (slot.status !== "available") return err("Slot is not available", 409);

  const slotStart = new Date(slot.starts_at);
  const now = new Date();

  // Must be in the future
  if (slotStart <= now) return err("Slot has already passed", 409);

  // Within 7-day booking window
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (slotStart.getTime() - now.getTime() > sevenDaysMs) {
    return err("Slot is more than 7 days in advance", 422);
  }

  // ------------------------------------------------------------------
  // 4. Load resource
  // ------------------------------------------------------------------
  const { data: resource, error: resourceError } = await supabaseAdmin
    .from("resources")
    .select("id, resource_type, is_active")
    .eq("id", slot.resource_id)
    .single();

  if (resourceError || !resource) return err("Resource not found", 404);
  if (!resource.is_active) return err("Resource is not active", 422);

  const isTennis = resource.resource_type === "tennis_court";
  const slotHour = managuaHour(slot.starts_at);

  // ------------------------------------------------------------------
  // 5. Sanctions check — no active booking block on caller
  // ------------------------------------------------------------------
  const { data: activeSanction } = await supabaseAdmin
    .from("sanctions")
    .select("id, sanction_type, ends_at")
    .eq("member_id", caller.id)
    .eq("is_active", true)
    .neq("sanction_type", "warning") // warnings don't block booking
    .or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`)
    .maybeSingle();

  if (activeSanction) {
    const until = activeSanction.ends_at
      ? ` until ${activeSanction.ends_at}`
      : " pending committee review";
    return err(`Account is blocked from making bookings${until}`, 403);
  }

  // ------------------------------------------------------------------
  // 6. One-active-booking check
  // ------------------------------------------------------------------
  const { data: existingBooking } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("member_id", caller.id)
    .in("status", ["pending_approval", "confirmed"])
    .maybeSingle();

  if (existingBooking) {
    return err("Member already has an active booking", 409);
  }

  // ------------------------------------------------------------------
  // 7. Age-tier rules
  // ------------------------------------------------------------------
  let initialStatus: "confirmed" | "pending_approval" = "confirmed";

  if (caller.age_tier === "under_12") {
    // Under-12 bookings always require admin approval.
    initialStatus = "pending_approval";
  } else if (caller.age_tier === "minor") {
    // School-hours block: Mon–Fri 07:00–14:00, unless a holiday is declared.
    if (isWeekday(slot.starts_at) && slotHour >= 7 && slotHour < 14) {
      // Check if this date is on the holiday calendar.
      const slotDateStr = managuaDateString(slot.starts_at);
      const { data: holiday } = await supabaseAdmin
        .from("holiday_calendar")
        .select("id")
        .eq("date", slotDateStr)
        .maybeSingle();

      if (!holiday) {
        return err(
          "Minors cannot book during school hours (Mon–Fri 07:00–14:00)",
          422
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // 8. Guest rules
  // ------------------------------------------------------------------
  if (isGuestBooking) {
    // Guest bookings always require admin approval.
    initialStatus = "pending_approval";

    // Sponsor may not have another pending guest booking.
    const { data: pendingGuest } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("member_id", caller.id)
      .eq("is_guest_booking", true)
      .eq("status", "pending_approval")
      .maybeSingle();

    if (pendingGuest) {
      return err(
        "You already have a pending guest booking awaiting approval",
        409
      );
    }
  }

  // ------------------------------------------------------------------
  // 9. Household peak-hour tennis cap (tennis only)
  // ------------------------------------------------------------------
  if (isTennis && isPeakHour(slotHour)) {
    // Count confirmed/pending tennis court bookings for the household
    // that overlap this slot (same starts_at).
    const { count, error: capError } = await supabaseAdmin
      .from("bookings")
      .select(
        `id,
         slots!inner(starts_at, resources!inner(resource_type))`,
        { count: "exact", head: true }
      )
      .in("status", ["pending_approval", "confirmed"])
      .eq("slots.starts_at", slot.starts_at)
      .eq("slots.resources.resource_type", "tennis_court")
      .in(
        "member_id",
        // Sub-select all member IDs in the same household
        supabaseAdmin
          .from("members")
          .select("id")
          .eq("household_id", caller.household_id)
      );

    if (capError) {
      console.error("Peak-hour cap query failed:", capError);
      return err("Failed to check household peak-hour cap", 500);
    }

    if ((count ?? 0) >= 2) {
      return err(
        "Household has reached the peak-hour limit of 2 tennis courts",
        422
      );
    }
  }

  // ------------------------------------------------------------------
  // 10. Sparring 12-hour window
  // ------------------------------------------------------------------
  const hasSparring = addons.some((a) => a.addon_type === "sparring");
  if (hasSparring) {
    const diffMs = slotStart.getTime() - now.getTime();
    if (diffMs > 12 * 60 * 60 * 1000) {
      return err(
        "Sparring partners can only be booked within 12 hours of the slot start",
        422
      );
    }
  }

  // ------------------------------------------------------------------
  // 11. Court lights eligibility
  // ------------------------------------------------------------------
  const hasLights = addons.some((a) => a.addon_type === "court_lights");
  if (hasLights) {
    if (!isTennis) {
      return err("Court lights are only available for tennis courts", 422);
    }
    if (slotHour < 17) {
      return err("Court lights are only available for slots starting at 17:00 or later", 422);
    }
  }

  // ------------------------------------------------------------------
  // 12. Price computation
  // ------------------------------------------------------------------

  // Build the list of price_item keys we need.
  const priceKeys: string[] = [isTennis ? "tennis_court" : "bowling_lane"];
  for (const addon of addons) {
    priceKeys.push(addon.addon_type); // key matches addon_type for all add-ons
  }

  const { data: priceRows, error: priceError } = await supabaseAdmin
    .from("price_items")
    .select("key, price_nio")
    .in("key", priceKeys)
    .eq("is_active", true);

  if (priceError || !priceRows) {
    return err("Failed to fetch price table", 500);
  }

  const priceMap = Object.fromEntries(
    priceRows.map((p: { key: string; price_nio: number }) => [p.key, Number(p.price_nio)])
  );

  const courtKey = isTennis ? "tennis_court" : "bowling_lane";
  if (priceMap[courtKey] === undefined) {
    return err(`Price not configured for ${courtKey}`, 500);
  }

  let totalNio = priceMap[courtKey];
  const addonPrices: { addon_type: string; price: number }[] = [];

  for (const addon of addons) {
    const price = priceMap[addon.addon_type];
    if (price === undefined) {
      return err(`Price not configured for add-on: ${addon.addon_type}`, 500);
    }
    totalNio += price;
    addonPrices.push({ addon_type: addon.addon_type, price });
  }

  // ------------------------------------------------------------------
  // 13. Atomic DB write via Postgres function
  //     We call a DB-side RPC that does everything in one transaction:
  //       a. UPDATE slots SET status = 'reserved'
  //       b. INSERT INTO bookings
  //       c. INSERT INTO booking_addons (for each add-on)
  //       d. Mark provider_availability.is_booked = true (for lesson/sparring)
  //       e. INSERT INTO charges (status = 'pending')
  //     Using an RPC keeps the write atomic — no partial state if something fails.
  // ------------------------------------------------------------------

  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    "create_booking_atomic",
    {
      p_slot_id: slot_id,
      p_member_id: caller.id,
      p_status: initialStatus,
      p_is_guest_booking: isGuestBooking,
      p_guest_name: guest_name ?? null,
      p_guest_email: guest_email ?? null,
      p_total_nio: totalNio,
      p_addons: addons.map((a, i) => ({
        addon_type: a.addon_type,
        provider_availability_id: a.provider_availability_id ?? null,
        price_at_booking_nio: addonPrices[i]?.price ?? 0,
      })),
    }
  );

  if (rpcError) {
    console.error("create_booking_atomic failed:", rpcError);
    // Surface Postgres constraint violations as 422 instead of 500.
    if (rpcError.code === "23505") {
      return err("Slot was just taken by another booking", 409);
    }
    return err("Failed to create booking", 500);
  }

  const { booking_id, charge_id } = rpcResult as {
    booking_id: string;
    charge_id: string;
  };

  // ------------------------------------------------------------------
  // 14. Trigger notifications (fire-and-forget — don't fail the booking)
  // ------------------------------------------------------------------
  EdgeRuntime.waitUntil(
    sendNotifications({
      booking_id,
      member_id: caller.id,
      status: initialStatus,
      is_guest_booking: isGuestBooking,
      guest_email: guest_email ?? null,
      slot_starts_at: slot.starts_at,
      resource_type: resource.resource_type,
      total_nio: totalNio,
    })
  );

  // ------------------------------------------------------------------
  // 15. Return
  // ------------------------------------------------------------------
  return ok(
    {
      booking_id,
      charge_id,
      status: initialStatus,
      total_nio: totalNio,
      // BAC payment step: client uses charge_id to initiate the payment
      // flow. On BAC callback, bac-webhook function captures the charge.
      // Pending BAC integration docs — see ADR-0002.
      payment_pending: true,
    },
    initialStatus === "pending_approval" ? 202 : 201
  );
});

// ---------------------------------------------------------------------------
// Notification helper (fire-and-forget)
// ---------------------------------------------------------------------------

interface NotificationPayload {
  booking_id: string;
  member_id: string;
  status: "confirmed" | "pending_approval";
  is_guest_booking: boolean;
  guest_email: string | null;
  slot_starts_at: string;
  resource_type: string;
  total_nio: number;
}

async function sendNotifications(p: NotificationPayload): Promise<void> {
  try {
    if (p.status === "pending_approval") {
      // Notify admins by email with Approve / Decline buttons.
      // The actual email send (Resend/SendGrid) is wired in a later milestone.
      // For now, insert a notification_queue row that a separate worker picks up.
      await supabaseAdmin.from("notification_queue").insert({
        type: p.is_guest_booking ? "guest_approval_request" : "under12_approval_request",
        payload: p,
        channel: "email",
      });
    } else {
      // Confirmed booking — send push + email to member.
      await supabaseAdmin.from("notification_queue").insert([
        { type: "booking_confirmed", payload: p, channel: "push" },
        { type: "booking_confirmed", payload: p, channel: "email" },
      ]);
    }
  } catch (e) {
    // Log but never surface to the caller.
    console.error("Failed to queue notification:", e);
  }
}

// Deno Deploy / Supabase Edge Functions global
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };
