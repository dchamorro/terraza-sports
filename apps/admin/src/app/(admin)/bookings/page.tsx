import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Card, Table, Thead, Th, Tbody, Td, Badge, EmptyState,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { CheckInButton } from "./check-in-button";
import { rel } from "@/lib/cn";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const { status, date } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(
      `id, status, is_guest_booking, guest_name, checked_in_at, created_at,
       members!inner(full_name, email),
       slots!inner(starts_at, resources!inner(name, resource_type)),
       booking_addons(addon_type)`
    )
    .order("slots(starts_at)", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  if (date) {
    const start = `${date}T06:00:00Z`; // midnight Managua ≈ 06:00 UTC
    const end = `${date}T05:59:59Z`;   // next midnight
    const dayStart = new Date(date);
    dayStart.setUTCHours(6, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    query = query
      .gte("slots.starts_at", dayStart.toISOString())
      .lt("slots.starts_at", dayEnd.toISOString());
  }

  const { data: bookings } = await query;

  return (
    <>
      <PageHeader
        title="Reservaciones"
        description="Historial completo — filtrar por estado o fecha."
      />

      <div className="mb-4 flex gap-3">
        <FilterLink href="/bookings" label="Todas" active={!status} />
        <FilterLink href="/bookings?status=confirmed" label="Confirmadas" active={status === "confirmed"} />
        <FilterLink href="/bookings?status=pending_approval" label="Pendientes" active={status === "pending_approval"} />
        <FilterLink href="/bookings?status=checked_in" label="Registradas" active={status === "checked_in"} />
        <FilterLink href="/bookings?status=no_show" label="No asistió" active={status === "no_show"} />
        <FilterLink href="/bookings?status=cancelled" label="Canceladas" active={status === "cancelled"} />
      </div>

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Miembro</Th>
              <Th>Invitado</Th>
              <Th>Cancha / Pista</Th>
              <Th>Fecha y hora</Th>
              <Th>Add-ons</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {(bookings ?? []).map((b) => {
              const member = rel<{ full_name: string; email: string }>(b.members);
              const slot = rel<{
                starts_at: string;
                resources: { name: string; resource_type: string };
              }>(b.slots);
              const addons = rel<{ addon_type: string }[]>(b.booking_addons ?? []);
              return (
                <tr key={b.id}>
                  <Td>
                    <span className="font-medium">{member.full_name}</span>
                    <br />
                    <span className="text-xs text-gray-400">{member.email}</span>
                  </Td>
                  <Td>
                    {b.is_guest_booking ? (
                      <span className="text-sm">{b.guest_name}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </Td>
                  <Td>{slot.resources.name}</Td>
                  <Td>{formatDateTime(slot.starts_at)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {addons.map((a) => (
                        <Badge key={a.addon_type} variant="muted">
                          {addonLabel(a.addon_type)}
                        </Badge>
                      ))}
                      {!addons.length && (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <BookingStatusBadge status={b.status as string} />
                  </Td>
                  <Td>
                    {b.status === "confirmed" && !b.checked_in_at && (
                      <CheckInButton bookingId={b.id} />
                    )}
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
        {!bookings?.length && (
          <EmptyState
            title="Sin reservaciones"
            description="Intenta cambiar el filtro."
          />
        )}
      </Card>
    </>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </a>
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

function addonLabel(type: string) {
  const map: Record<string, string> = {
    equipment_rental: "Equipo",
    lesson: "Clase",
    sparring: "Sparring",
    court_lights: "Luces",
  };
  return map[type] ?? type;
}
