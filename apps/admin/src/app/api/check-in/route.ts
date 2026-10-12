export const dynamic = "force-dynamic";
// Route Handler: POST /api/check-in
// Manual check-in by admin (alternative to QR scan).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Resolve the admin member ID for the checked_in_by field.
  const { data: adminMember } = await supabase
    .from("members")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!adminMember || !["admin", "sports_manager"].includes(adminMember.role)) {
    return NextResponse.json({ error: "Sin permiso para hacer check-in" }, { status: 403 });
  }

  const { booking_id } = await req.json();
  if (!booking_id) return NextResponse.json({ error: "booking_id requerido" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
      checked_in_by: adminMember.id,
    })
    .eq("id", booking_id)
    .eq("status", "confirmed");

  if (error) {
    return NextResponse.json({ error: "No se pudo registrar la entrada" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
