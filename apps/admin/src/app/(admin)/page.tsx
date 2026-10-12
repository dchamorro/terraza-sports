import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, StatCard, Card, Table, Thead, Th, Tbody, Td, Badge } from "@/components/ui";
import { formatNio, formatDateTime } from "@/lib/format";
import { rel } from "@/lib/cn";

export default async function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: pendingApprovals },
    { count: todayBookings },
    { count: activeSanctions },
    { count: openFlags },
    { data: recentBookings },
  ] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_approval"),
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`)
      .lte("created_at", `${today}T23:59:59Z`),
    supabaseAdmin
      .from("sanctions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .neq("sanction_type", "warning"),
    supabaseAdmin
      .from("abuse_flags")
      .select("*", { count: "exact", head: true })
      .is("confirmed_at", null)
      .is("dismissed_at", null),
    supabaseAdmin
      .from("bookings")
      .select(
        `id, status, created_at,
         members!inner(full_name),
         slots!inner(starts_at, resources!inner(name, resource_type))`
      )
      .in("status", ["confirmed", "pending_approval"])
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <>
      <PageHeader title="Inicio" description={`Hoy, ${formatDate(today)}`} />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Aprobaciones pendientes"
          value={pendingApprovals ?? 0}
          sub="Reservaciones por confirmar"
        />
        <StatCard
          label="Reservaciones hoy"
          value={todayBookings ?? 0}
          sub="Nuevas en las últimas 24 h"
        />
        <StatCard
          label="Sanciones activas"
          value={activeSanctions ?? 0}
          sub="Bloqueos vigentes"
        />
        <StatCard
          label="Alertas de abuso"
          value={openFlags ?? 0}
          sub="Pendientes de confirmar"
        />
      </div>

      <Card>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-medium text-gray-900">
            Reservaciones recientes
          </h2>
        </div>
        <Table>
          <Thead>
            <tr>
              <Th>Miembro</Th>
              <Th>Cancha / Pista</Th>
              <Th>Fecha y hora</Th>
              <Th>Estado</Th>
            </tr>
          </Thead>
          <Tbody>
            {(recentBookings ?? []).map((b) => {
              const member = rel<{ full_name: string }>(b.members);
              const slot = rel<{
                starts_at: string;
                resources: { name: string; resource_type: string };
              }>(b.slots);
              return (
                <tr key={b.id}>
                  <Td>{member.full_name}</Td>
                  <Td>{slot.resources.name}</Td>
                  <Td>{formatDateTime(slot.starts_at)}</Td>
                  <Td>
                    <BookingStatusBadge status={b.status as string} />
                  </Td>
                </tr>
              );
            })}
            {!recentBookings?.length && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-gray-400">
                  Sin reservaciones recientes
                </td>
              </tr>
            )}
          </Tbody>
        </Table>
      </Card>
    </>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "muted" }> = {
    confirmed: { label: "Confirmada", variant: "success" },
    pending_approval: { label: "Pendiente", variant: "warning" },
    cancelled: { label: "Cancelada", variant: "muted" },
    no_show: { label: "No asistió", variant: "danger" },
    checked_in: { label: "Registrado", variant: "default" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-NI", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
