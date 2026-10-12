export const dynamic = "force-dynamic";
// Route Handler: POST /api/register-dependent
// Admin registers a dependent (child) under an existing member's household.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminOrAbove } from "@/lib/roles";

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

  const { parent_id, full_name, email, date_of_birth } = await req.json();
  if (!parent_id || !full_name || !email || !date_of_birth) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  // Resolve the parent's household.
  const { data: parent } = await supabaseAdmin
    .from("members")
    .select("id, household_id")
    .eq("id", parent_id)
    .single();

  if (!parent) {
    return NextResponse.json({ error: "Miembro titular no encontrado" }, { status: 404 });
  }

  // Compute age_tier from date_of_birth.
  const ageBirthday = new Date(date_of_birth);
  const ageMs = Date.now() - ageBirthday.getTime();
  const ageYears = ageMs / (365.25 * 24 * 3600 * 1000);
  const age_tier =
    ageYears < 12 ? "under_12" : ageYears < 18 ? "minor" : "adult";

  const { error } = await supabaseAdmin.from("members").insert({
    full_name,
    email,
    date_of_birth,
    age_tier,
    household_id: parent.household_id,
    parent_id: parent.id,
    is_dependent: true,
    role: "member",
  });

  if (error?.code === "23505") {
    return NextResponse.json({ error: "Ya existe un miembro con ese correo" }, { status: 409 });
  }
  if (error) {
    return NextResponse.json({ error: "No se pudo registrar el dependiente" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
