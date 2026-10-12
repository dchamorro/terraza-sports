"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

interface MemberOption {
  id: string;
  full_name: string;
}

export function RegisterDependentButton({
  members,
}: {
  members: MemberOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);

  const adults = members;

  async function save() {
    if (!parentId || !fullName || !email || !dob) return;
    setSaving(true);
    try {
      const res = await fetch("/api/register-dependent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_id: parentId,
          full_name: fullName,
          email,
          date_of_birth: dob,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Error al registrar");
        return;
      }
      setOpen(false);
      setParentId("");
      setFullName("");
      setEmail("");
      setDob("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + Registrar dependiente
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Titular del hogar
        </label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Seleccionar…</option>
          {adults.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Nombre completo
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-44 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Correo electrónico
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-44 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Fecha de nacimiento
        </label>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <Button
        variant="primary"
        size="sm"
        disabled={saving || !parentId || !fullName || !email || !dob}
        onClick={save}
      >
        {saving ? "…" : "Guardar"}
      </Button>
      <Button variant="ghost" size="sm" disabled={saving} onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </div>
  );
}
