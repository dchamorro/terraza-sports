"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ApproveDeclineButtons({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "decline" | null>(null);

  async function act(action: "approve" | "decline") {
    setLoading(action);
    try {
      const res = await fetch("/api/approve-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, action }),
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
        variant="primary"
        size="sm"
        disabled={loading !== null}
        onClick={() => act("approve")}
      >
        {loading === "approve" ? "…" : "Aprobar"}
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={loading !== null}
        onClick={() => act("decline")}
      >
        {loading === "decline" ? "…" : "Rechazar"}
      </Button>
    </div>
  );
}
