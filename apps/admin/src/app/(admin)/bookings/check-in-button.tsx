"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function CheckInButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCheckIn() {
    setLoading(true);
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Error al registrar entrada");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" disabled={loading} onClick={handleCheckIn}>
      {loading ? "…" : "Check-in"}
    </Button>
  );
}
