import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isSportsManager } from "@/lib/roles";
import {
  PageHeader, Card, Table, Thead, Th, Tbody, Td,
} from "@/components/ui";
import { formatNio, formatDateTime } from "@/lib/format";
import { PriceEditForm } from "./price-edit-form";
import { rel } from "@/lib/cn";

export default async function PricesPage() {
  const supabase = await createClient();

  // Guard: Sports Manager only.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("auth_user_id", user!.id)
    .single();

  if (!member || !isSportsManager(member.role as never)) {
    redirect("/");
  }

  const [{ data: prices }, { data: auditLog }] = await Promise.all([
    supabase
      .from("price_items")
      .select("id, key, label, price_nio, is_active, updated_at")
      .order("key"),
    supabase
      .from("price_item_audit")
      .select(
        `id, old_price_nio, new_price_nio, changed_at,
         price_items!inner(label),
         members!inner(full_name)`
      )
      .order("changed_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <PageHeader
        title="Tabla de precios"
        description="Solo el Sports Manager puede editar precios. Cada cambio queda registrado."
      />

      <Card className="mb-6">
        <Table>
          <Thead>
            <tr>
              <Th>Concepto</Th>
              <Th>Precio actual</Th>
              <Th>Última actualización</Th>
              <Th>Activo</Th>
              <Th>Editar</Th>
            </tr>
          </Thead>
          <Tbody>
            {(prices ?? []).map((p) => (
              <tr key={p.id}>
                <Td>
                  <span className="font-medium">{p.label}</span>
                  <br />
                  <span className="font-mono text-xs text-gray-400">{p.key}</span>
                </Td>
                <Td className="font-medium">{formatNio(p.price_nio)}</Td>
                <Td className="text-xs text-gray-400">
                  {formatDateTime(p.updated_at)}
                </Td>
                <Td>
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      p.is_active ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </Td>
                <Td>
                  <PriceEditForm
                    id={p.id}
                    currentPrice={Number(p.price_nio)}
                    label={p.label}
                  />
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-gray-700">
        Historial de cambios (últimos 20)
      </h2>
      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Concepto</Th>
              <Th>Precio anterior</Th>
              <Th>Nuevo precio</Th>
              <Th>Cambiado por</Th>
              <Th>Fecha</Th>
            </tr>
          </Thead>
          <Tbody>
            {(auditLog ?? []).map((a) => {
              const item = rel<{ label: string }>(a.price_items);
              const who = rel<{ full_name: string }>(a.members);
              return (
                <tr key={a.id}>
                  <Td>{item.label}</Td>
                  <Td className="text-gray-400">
                    {a.old_price_nio != null ? formatNio(a.old_price_nio) : "—"}
                  </Td>
                  <Td className="font-medium">{formatNio(a.new_price_nio)}</Td>
                  <Td>{who.full_name}</Td>
                  <Td className="text-xs text-gray-400">
                    {formatDateTime(a.changed_at)}
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>
    </>
  );
}
