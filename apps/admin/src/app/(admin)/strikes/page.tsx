import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  PageHeader, Card, Table, Thead, Th, Tbody, Td, Badge, EmptyState,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { ConfirmFlagButtons } from "./confirm-flag-buttons";
import { WaiveStrikeButton } from "./waive-strike-button";
import { rel } from "@/lib/cn";

export default async function StrikesPage() {
  const [{ data: flags }, { data: strikes }] = await Promise.all([
    // Unconfirmed abuse flags — admin must confirm before a strike is issued.
    supabaseAdmin
      .from("abuse_flags")
      .select(
        `id, offense_type, detected_at,
         members!inner(full_name),
         bookings!abuse_flags_booking_id_fkey(id, slots!inner(starts_at, resources!inner(name))),
         related_booking:bookings!abuse_flags_related_booking_id_fkey(id)`
      )
      .is("confirmed_at", null)
      .is("dismissed_at", null)
      .order("detected_at", { ascending: false }),

    // Active strikes.
    supabaseAdmin
      .from("strikes")
      .select(
        `id, offense_type, status, issued_at, erased_at, waived_at, waiver_reason,
         members!inner(full_name)`
      )
      .order("issued_at", { ascending: false })
      .limit(60),
  ]);

  return (
    <>
      <PageHeader
        title="Faltas y sanciones"
        description="Alertas de abuso pendientes de confirmación y registro histórico de strikes."
      />

      {/* ── Pending abuse flags ────────────────────────── */}
      <h2 className="mb-3 text-sm font-medium text-gray-700">
        Alertas pendientes de confirmación
      </h2>
      <Card className="mb-8">
        <Table>
          <Thead>
            <tr>
              <Th>Miembro</Th>
              <Th>Tipo de falta</Th>
              <Th>Detectada</Th>
              <Th>Reservación</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {(flags ?? []).map((f) => {
              const member = rel<{ full_name: string }>(f.members);
              const booking = rel<null | {
                id: string;
                slots: { starts_at: string; resources: { name: string } };
              }>(f.bookings);
              return (
                <tr key={f.id}>
                  <Td className="font-medium">{member.full_name}</Td>
                  <Td>
                    <OffenseBadge type={f.offense_type} />
                  </Td>
                  <Td className="text-xs text-gray-400">
                    {formatDateTime(f.detected_at)}
                  </Td>
                  <Td className="text-xs text-gray-400">
                    {booking
                      ? `${booking.slots.resources.name} · ${formatDateTime(booking.slots.starts_at)}`
                      : "—"}
                  </Td>
                  <Td>
                    <ConfirmFlagButtons flagId={f.id} />
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
        {!flags?.length && (
          <EmptyState title="Sin alertas pendientes" />
        )}
      </Card>

      {/* ── Strike log ─────────────────────────────────── */}
      <h2 className="mb-3 text-sm font-medium text-gray-700">
        Registro de strikes
      </h2>
      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Miembro</Th>
              <Th>Tipo de falta</Th>
              <Th>Estado</Th>
              <Th>Emitido</Th>
              <Th>Expirado / Anulado</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {(strikes ?? []).map((s) => {
              const member = rel<{ full_name: string }>(s.members);
              return (
                <tr key={s.id}>
                  <Td className="font-medium">{member.full_name}</Td>
                  <Td>
                    <OffenseBadge type={s.offense_type} />
                  </Td>
                  <Td>
                    <StrikeStatusBadge status={s.status} />
                  </Td>
                  <Td className="text-xs text-gray-400">
                    {formatDateTime(s.issued_at)}
                  </Td>
                  <Td className="text-xs text-gray-400">
                    {s.erased_at
                      ? `Expirado ${formatDateTime(s.erased_at)}`
                      : s.waived_at
                      ? `Anulado ${formatDateTime(s.waived_at)}`
                      : "—"}
                  </Td>
                  <Td>
                    {s.status === "active" && (
                      <WaiveStrikeButton strikeId={s.id} />
                    )}
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
        {!strikes?.length && (
          <EmptyState title="Sin strikes registrados" />
        )}
      </Card>
    </>
  );
}

function OffenseBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: "danger" | "warning" | "default" | "muted" }> = {
    no_show: { label: "No asistió", variant: "warning" },
    dependent_swap: { label: "Swap de familiar", variant: "danger" },
    account_impersonation: { label: "Cuenta ajena", variant: "danger" },
    guest_rule_violation: { label: "Regla de invitados", variant: "muted" },
  };
  const { label, variant } = map[type] ?? { label: type, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}

function StrikeStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "danger" | "muted" | "success" }> = {
    active: { label: "Activo", variant: "danger" },
    erased: { label: "Expirado", variant: "muted" },
    waived: { label: "Anulado", variant: "success" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}
