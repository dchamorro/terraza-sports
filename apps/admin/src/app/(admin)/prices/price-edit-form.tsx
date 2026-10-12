"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function PriceEditForm({
  id,
  currentPrice,
  label,
}: {
  id: string;
  currentPrice: number;
  label: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentPrice.toFixed(2));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, price_nio: parseFloat(value) }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Error al guardar");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Editar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
      <Button variant="primary" size="sm" disabled={saving} onClick={save}>
        {saving ? "…" : "Guardar"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={saving}
        onClick={() => {
          setEditing(false);
          setValue(currentPrice.toFixed(2));
        }}
      >
        Cancelar
      </Button>
    </div>
  );
}
