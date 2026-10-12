"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ConfirmFlagButtons({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "dismiss" | null>(null);

  async function act(action: "confirm" | "dismiss") {
    setLoading(action);
    try {
      const res = await fetch("/api/resolve-flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag_id: flagId, action }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Error inesperado");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="danger"
        size="sm"
        disabled={loading !== null}
        onClick={() => act("confirm")}
      >
        {loading === "confirm" ? "…" : "Confirmar falta"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={loading !== null}
        onClick={() => act("dismiss")}
      >
        {loading === "dismiss" ? "…" : "Descartar"}
      </Button>
    </div>
  );
}
