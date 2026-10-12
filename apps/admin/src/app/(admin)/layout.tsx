import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch the member row to get role for permission-gating in the UI.
  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!member) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={member.role as string} userName={member.full_name} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
