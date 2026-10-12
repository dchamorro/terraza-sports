"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function RemoveHolidayButton({ holidayId }: { holidayId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm("¿Eliminar este día festivo?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/holiday", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holidayId }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Error al eliminar");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" disabled={loading} onClick={remove}>
      {loading ? "…" : "Eliminar"}
    </Button>
  );
}
