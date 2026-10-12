"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function AddHolidayForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!date) return;
    setSaving(true);
    try {
      const res = await fetch("/api/holiday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, description }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Error al guardar");
        return;
      }
      setOpen(false);
      setDate("");
      setDescription("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        + Agregar fecha
      </Button>
    );
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Descripción (opcional)
        </label>
        <input
          type="text"
          placeholder="Ej: Semana Santa"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-44 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <Button variant="primary" size="sm" disabled={saving || !date} onClick={save}>
        {saving ? "…" : "Guardar"}
      </Button>
      <Button variant="ghost" size="sm" disabled={saving} onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </div>
  );
}
