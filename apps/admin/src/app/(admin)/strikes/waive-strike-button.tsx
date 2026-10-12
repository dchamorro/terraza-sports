"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function WaiveStrikeButton({ strikeId }: { strikeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function waive() {
    if (!reason.trim()) {
      alert("Debe ingresar un motivo para anular el strike.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/waive-strike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strike_id: strikeId, reason }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Error al anular");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Anular
      </Button>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <textarea
        rows={2}
        placeholder="Motivo de la anulación…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-48 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
      />
      <div className="flex flex-col gap-1">
        <Button variant="primary" size="sm" disabled={saving} onClick={waive}>
          {saving ? "…" : "Guardar"}
        </Button>
        <Button variant="ghost" size="sm" disabled={saving} onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
