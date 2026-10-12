export const dynamic = "force-dynamic";
// Route Handler: POST /api/triage-idea

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
    return NextResponse.json({ error: "Solo el Sports Manager puede hacer triage" }, { status: 403 });
  }

  const { idea_id, status, note } = await req.json();
  const valid = ["new", "under_review", "adopted", "declined"];
  if (!idea_id || !valid.includes(status)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("ideas_inbox")
    .update({
      status,
      triaged_by: member.id,
      triaged_at: new Date().toISOString(),
      triage_note: note?.trim() || null,
    })
    .eq("id", idea_id);

  if (error) return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
