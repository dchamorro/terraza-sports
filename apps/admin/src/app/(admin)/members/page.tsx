import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Card, Table, Thead, Th, Tbody, Td, Badge, EmptyState,
} from "@/components/ui";
import { RegisterDependentButton } from "./register-dependent-button";
import { rel } from "@/lib/cn";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("members")
    .select(
      `id, full_name, email, role, age_tier, is_dependent, is_active, date_of_birth,
       households!inner(name),
       parent:members!members_parent_id_fkey(full_name)`
    )
    .order("full_name")
    .limit(150);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: members } = await query;

  return (
    <>
      <PageHeader
        title="Miembros"
        description="Lista de miembros y dependientes. Los miembros se sincronizan desde el sistema del club."
        action={<RegisterDependentButton members={members ?? []} />}
      />

      {/* Search */}
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o correo…"
          className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </form>

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Correo</Th>
              <Th>Rol</Th>
              <Th>Edad</Th>
              <Th>Hogar</Th>
              <Th>Titular</Th>
              <Th>Activo</Th>
            </tr>
          </Thead>
          <Tbody>
            {(members ?? []).map((m) => {
              const household = rel<{ name: string }>(m.households);
              const parent = rel<null | { full_name: string }>(m.parent);
              return (
                <tr key={m.id}>
                  <Td>
                    <span className="font-medium">{m.full_name}</span>
                  </Td>
                  <Td className="text-xs text-gray-500">{m.email}</Td>
                  <Td>
                    <RoleBadge role={m.role} />
                  </Td>
                  <Td>
                    <AgeBadge tier={m.age_tier} dob={m.date_of_birth} />
                  </Td>
                  <Td className="text-xs">{household.name}</Td>
                  <Td className="text-xs text-gray-500">
                    {parent?.full_name ?? <span className="text-gray-300">—</span>}
                  </Td>
                  <Td>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        m.is_active ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
        {!members?.length && (
          <EmptyState
            title="Sin resultados"
            description="Intenta cambiar la búsqueda."
          />
        )}
      </Card>
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; variant: "default" | "success" | "muted" | "warning" }> = {
    member: { label: "Miembro", variant: "muted" },
    admin: { label: "Admin", variant: "default" },
    sports_manager: { label: "Sports Manager", variant: "success" },
    committee: { label: "Comité", variant: "warning" },
    coach: { label: "Coach", variant: "default" },
    sparring_partner: { label: "Sparring", variant: "muted" },
  };
  const { label, variant } = map[role] ?? { label: role, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}

function AgeBadge({
  tier,
  dob,
}: {
  tier: string;
  dob: string | null;
}) {
  const labels: Record<string, string> = {
    under_12: "< 12",
    minor: "12–17",
    adult: "Adulto",
  };
  const age = dob
    ? Math.floor(
        (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)
      )
    : null;
  return (
    <span className="text-xs text-gray-600">
      {labels[tier] ?? tier}
      {age != null && ` (${age} años)`}
    </span>
  );
}
