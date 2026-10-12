import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Card, Table, Thead, Th, Tbody, Td, Badge, EmptyState,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { ApproveDeclineButtons } from "./approve-decline-buttons";
import { rel } from "@/lib/cn";

export default async function ApprovalsPage() {
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("bookings")
    .select(
      `id, is_guest_booking, guest_name, guest_email, created_at,
       members!inner(full_name, email, age_tier, household_id),
       slots!inner(starts_at, resources!inner(name, resource_type))`
    )
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });

  return (
    <>
      <PageHeader
        title="Aprobaciones pendientes"
        description="Reservaciones de invitados y menores de 12 años que requieren confirmación."
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Tipo</Th>
              <Th>Miembro / Solicitante</Th>
              <Th>Invitado</Th>
              <Th>Cancha / Pista</Th>
              <Th>Fecha y hora</Th>
              <Th>Solicitado</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {(pending ?? []).map((b) => {
              const member = rel<{
                full_name: string;
                email: string;
                age_tier: string;
              }>(b.members);
              const slot = rel<{
                starts_at: string;
                resources: { name: string; resource_type: string };
              }>(b.slots);
              const type = b.is_guest_booking ? "Invitado" : "Menor de 12";
              return (
                <tr key={b.id}>
                  <Td>
                    <Badge variant={b.is_guest_booking ? "default" : "warning"}>
                      {type}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="font-medium text-gray-900">
                      {member.full_name}
                    </span>
                    <br />
                    <span className="text-xs text-gray-400">{member.email}</span>
                  </Td>
                  <Td>
                    {b.is_guest_booking ? (
                      <>
                        <span className="font-medium">{b.guest_name}</span>
                        <br />
                        <span className="text-xs text-gray-400">
                          {b.guest_email}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Td>
                  <Td>{slot.resources.name}</Td>
                  <Td>{formatDateTime(slot.starts_at)}</Td>
                  <Td className="text-gray-400 text-xs">
                    {formatDateTime(b.created_at)}
                  </Td>
                  <Td>
                    <ApproveDeclineButtons bookingId={b.id} />
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
        {!pending?.length && (
          <EmptyState
            title="Sin aprobaciones pendientes"
            description="Todo está al día."
          />
        )}
      </Card>
    </>
  );
}
