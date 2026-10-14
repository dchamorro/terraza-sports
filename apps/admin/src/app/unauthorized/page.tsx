"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Shown to authenticated users whose role is not allowed in the admin panel
 * (members, coaches, sparring partners). Offers sign-out so they can switch
 * accounts; there is nothing else for them to do here.
 */
export default function UnauthorizedPage() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Sin acceso</h1>
        <p className="mt-2 text-sm text-gray-500">
          Esta cuenta no tiene permisos para el panel de administración. Usa
          la aplicación móvil para reservar.
        </p>
        <button
          onClick={handleSignOut}
          className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
