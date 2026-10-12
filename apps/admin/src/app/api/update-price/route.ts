export const dynamic = "force-dynamic";
// Route Handler: POST /api/update-price
// Sports Manager only — updates a price_item and triggers audit log via Postgres trigger.

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
    return NextResponse.json({ error: "Solo el Sports Manager puede editar precios" }, { status: 403 });
  }

  const { id, price_nio } = await req.json();
  if (!id || price_nio == null) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  if (isNaN(price_nio) || price_nio < 0) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }

  // Use admin client so the audit trigger runs with the correct updated_by.
  const { error } = await supabaseAdmin
    .from("price_items")
    .update({ price_nio, updated_by: member.id })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar el precio" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
