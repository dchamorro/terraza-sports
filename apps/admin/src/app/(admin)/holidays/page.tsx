import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Card, Table, Thead, Th, Tbody, Td, EmptyState,
} from "@/components/ui";
import { AddHolidayForm } from "./add-holiday-form";
import { RemoveHolidayButton } from "./remove-holiday-button";
import { rel } from "@/lib/cn";

export default async function HolidaysPage() {
  const supabase = await createClient();

  const { data: holidays } = await supabase
    .from("holiday_calendar")
    .select("id, date, description, created_at, members!inner(full_name)")
    .order("date", { ascending: true });

  return (
    <>
      <PageHeader
        title="Calendario escolar"
        description="Los días marcados aquí suspenden el bloqueo de horario escolar para menores de 18 años."
        action={<AddHolidayForm />}
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Descripción</Th>
              <Th>Agregado por</Th>
              <Th />
            </tr>
          </Thead>
          <Tbody>
            {(holidays ?? []).map((h) => {
              const who = rel<{ full_name: string }>(h.members);
              return (
                <tr key={h.id}>
                  <Td className="font-medium tabular-nums">{h.date}</Td>
                  <Td>{h.description ?? <span className="text-gray-300">—</span>}</Td>
                  <Td className="text-xs text-gray-400">{who.full_name}</Td>
                  <Td>
                    <RemoveHolidayButton holidayId={h.id} />
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
        {!holidays?.length && (
          <EmptyState
            title="Sin días festivos registrados"
            description="Agrega fechas para suspender el bloqueo escolar."
          />
        )}
      </Card>
    </>
  );
}
