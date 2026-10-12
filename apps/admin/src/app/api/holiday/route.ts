export const dynamic = "force-dynamic";
// Route Handler: POST + DELETE /api/holiday

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminOrAbove } from "@/lib/roles";

async function getAdminMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("members")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();
  return data;
}

export async function POST(req: NextRequest) {
  const member = await getAdminMember();
  if (!member) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isAdminOrAbove(member.role as never)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { date, description } = await req.json();
  if (!date) return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("holiday_calendar")
    .insert({ date, description: description || null, created_by: member.id });

  if (error?.code === "23505") {
    return NextResponse.json({ error: "Esa fecha ya está registrada" }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const member = await getAdminMember();
  if (!member) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isAdminOrAbove(member.role as never)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await supabaseAdmin.from("holiday_calendar").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
