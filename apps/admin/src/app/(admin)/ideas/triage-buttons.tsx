"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const STATUSES = [
  { value: "under_review", label: "En revisión" },
  { value: "adopted", label: "Adoptar" },
  { value: "declined", label: "Descartar" },
] as const;

export function TriageButtons({
  ideaId,
  currentStatus,
}: {
  ideaId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  async function triage(newStatus: string) {
    setLoading(newStatus);
    try {
      const res = await fetch("/api/triage-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea_id: ideaId, status: newStatus, note }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Error");
        return;
      }
      setShowNote(false);
      setNote("");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (currentStatus === "adopted" || currentStatus === "declined") {
    return <span className="text-xs text-gray-300">Cerrada</span>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {STATUSES.filter((s) => s.value !== currentStatus).map((s) => (
        <Button
          key={s.value}
          variant={
            s.value === "adopted"
              ? "primary"
              : s.value === "declined"
              ? "danger"
              : "secondary"
          }
          size="sm"
          disabled={loading !== null}
          onClick={() => triage(s.value)}
        >
          {loading === s.value ? "…" : s.label}
        </Button>
      ))}
    </div>
  );
}
