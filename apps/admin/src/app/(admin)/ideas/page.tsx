import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Card, Table, Thead, Th, Tbody, Td, Badge, EmptyState,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { TriageButtons } from "./triage-buttons";
import { rel } from "@/lib/cn";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("ideas_inbox")
    .select(
      `id, title, body, status, submitter_role, created_at, triage_note,
       members!ideas_inbox_submitted_by_fkey(full_name)`
    )
    .order("created_at", { ascending: false })
    .limit(80);

  if (status) query = query.eq("status", status);

  const { data: ideas } = await query;

  return (
    <>
      <PageHeader
        title="Buzón de ideas"
        description="Sugerencias de miembros, admins y el comité. El Sports Manager hace el triage."
      />

      <div className="mb-4 flex gap-3">
        {(["", "new", "under_review", "adopted", "declined"] as const).map(
          (s) => (
            <a
              key={s}
              href={s ? `/ideas?status=${s}` : "/ideas"}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                (status ?? "") === s
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "" ? "Todas" : statusLabel(s)}
            </a>
          )
        )}
      </div>

      <div className="space-y-3">
        {(ideas ?? []).map((idea) => {
          const submitter = rel<null | { full_name: string }>(idea.members);
          return (
            <Card key={idea.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <IdeaStatusBadge status={idea.status} />
                    <RoleBadge role={idea.submitter_role} />
                    <span className="text-xs text-gray-400">
                      {submitter?.full_name ?? "Anónimo"} ·{" "}
                      {formatDateTime(idea.created_at)}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{idea.title}</p>
                  <p className="mt-1 text-sm text-gray-600 line-clamp-3">
                    {idea.body}
                  </p>
                  {idea.triage_note && (
                    <p className="mt-2 text-xs italic text-gray-400">
                      Nota: {idea.triage_note}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <TriageButtons ideaId={idea.id} currentStatus={idea.status} />
                </div>
              </div>
            </Card>
          );
        })}
        {!ideas?.length && (
          <EmptyState title="Sin ideas" description="Nada en este filtro." />
        )}
      </div>
    </>
  );
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    new: "Nuevas",
    under_review: "En revisión",
    adopted: "Adoptadas",
    declined: "Descartadas",
  };
  return map[s] ?? s;
}

function IdeaStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "warning" | "default" | "success" | "muted" }> = {
    new: { label: "Nueva", variant: "warning" },
    under_review: { label: "En revisión", variant: "default" },
    adopted: { label: "Adoptada", variant: "success" },
    declined: { label: "Descartada", variant: "muted" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    member: "Miembro",
    admin: "Admin",
    sports_manager: "Sports Manager",
    committee: "Comité",
  };
  return <Badge variant="muted">{map[role] ?? role}</Badge>;
}
