export const dynamic = "force-dynamic";
// Route Handler: POST /api/resolve-flag
// Confirm or dismiss an abuse flag. Confirming creates a strike + sanction.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminOrAbove } from "@/lib/roles";

// Sanctions ladder per offense type (strike count → sanction_type)
const LADDER: Record<string, string[]> = {
  no_show: ["warning", "block_7d", "block_30d"],
  dependent_swap: ["warning", "block_14d", "block_60d"],
  account_impersonation: ["block_14d", "block_60d", "committee_review"],
  guest_rule_violation: ["warning", "block_30d", "block_90d"],
};

const BLOCK_DURATIONS_DAYS: Record<string, number | null> = {
  warning: null,
  block_7d: 7,
  block_14d: 14,
  block_30d: 30,
  block_60d: 60,
  block_90d: 90,
  committee_review: null,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: adminMember } = await supabase
    .from("members")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!adminMember || !isAdminOrAbove(adminMember.role as never)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { flag_id, action } = await req.json();
  if (!flag_id || !["confirm", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  // Load the flag.
  const { data: flag } = await supabaseAdmin
    .from("abuse_flags")
    .select("id, member_id, offense_type, booking_id")
    .eq("id", flag_id)
    .single();

  if (!flag) return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });

  if (action === "dismiss") {
    await supabaseAdmin
      .from("abuse_flags")
      .update({ dismissed_by: adminMember.id, dismissed_at: new Date().toISOString() })
      .eq("id", flag_id);
    return NextResponse.json({ ok: true });
  }

  // Confirm: mark flag + create strike + compute and create sanction.
  await supabaseAdmin
    .from("abuse_flags")
    .update({ confirmed_by: adminMember.id, confirmed_at: new Date().toISOString() })
    .eq("id", flag_id);

  const { data: strikeRow, error: strikeError } = await supabaseAdmin
    .from("strikes")
    .insert({
      member_id: flag.member_id,
      offense_type: flag.offense_type,
      booking_id: flag.booking_id ?? null,
    })
    .select("id")
    .single();

  if (strikeError || !strikeRow) {
    return NextResponse.json({ error: "No se pudo crear el strike" }, { status: 500 });
  }

  // Count active strikes for this member + offense type (including the one just created).
  const { count: strikeCount } = await supabaseAdmin
    .from("strikes")
    .select("*", { count: "exact", head: true })
    .eq("member_id", flag.member_id)
    .eq("offense_type", flag.offense_type)
    .eq("status", "active");

  const ladder = LADDER[flag.offense_type] ?? ["warning"];
  const idx = Math.min((strikeCount ?? 1) - 1, ladder.length - 1);
  const sanctionType = ladder[idx];
  const durationDays = BLOCK_DURATIONS_DAYS[sanctionType] ?? null;
  const endsAt = durationDays
    ? new Date(Date.now() + durationDays * 86400000).toISOString()
    : null;

  await supabaseAdmin.from("sanctions").insert({
    member_id: flag.member_id,
    offense_type: flag.offense_type,
    sanction_type: sanctionType,
    strike_id: strikeRow.id,
    ends_at: endsAt,
  });

  return NextResponse.json({ ok: true, sanction: sanctionType });
}
