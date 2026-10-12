export const dynamic = "force-dynamic";
// Route Handler: POST /api/waive-strike
// Sports Manager only — waive an active strike (requires a reason).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isSportsManager } from "@/lib/roles";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: member } = await supabase
    .from("members")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!member || !isSportsManager(member.role as never)) {
    return NextResponse.json({ error: "Solo el Sports Manager puede anular strikes" }, { status: 403 });
  }

  const { strike_id, reason } = await req.json();
  if (!strike_id || !reason?.trim()) {
    return NextResponse.json({ error: "Se requiere un motivo" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("strikes")
    .update({
      status: "waived",
      waived_at: new Date().toISOString(),
      waived_by: member.id,
      waiver_reason: reason.trim(),
    })
    .eq("id", strike_id)
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: "No se pudo anular el strike" }, { status: 500 });
  }

  // Deactivate the associated sanction.
  await supabaseAdmin
    .from("sanctions")
    .update({ is_active: false })
    .eq("strike_id", strike_id);

  return NextResponse.json({ ok: true });
}
