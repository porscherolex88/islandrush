import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCell } from "@/components/admin/resource-cells";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, withQuery, str, type Column } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { getResourceDef, resourceHref, type RelationKey } from "@/lib/admin/resource-fields";
import { requireAdmin } from "@/lib/auth/session";
import { listResource } from "@/server/admin/list";

export async function generateMetadata({ params }: PageProps<"/admin/manage/[resource]">): Promise<Metadata> {
  return { title: getResourceDef((await params).resource)?.label ?? "Manage" };
}

export default async function ResourceListPage({ params, searchParams }: PageProps<"/admin/manage/[resource]">) {
  const [{ resource }, sp] = await Promise.all([params, searchParams]);
  const def = getResourceDef(resource);
  if (!def) notFound();
  await requireAdmin(def.permission);
  const data = await listResource(resource, sp);
  if (!data) notFound();
  const basePath = `/admin/manage/${resource}`;
  const fieldByName = Object.fromEntries(def.fields.map((f) => [f.name, f]));
  const filterFields = def.fields.filter(
    (f) => (f.type === "select" && ["status", "kind", "rewardType", "type", "ownerType", "audience", "action", "condition", "mode", "rarity"].includes(f.name)) || (f.type === "relation" && ["poolId", "areaId", "mapId", "collectionId"].includes(f.name)),
  );
  const presetQuery = Object.fromEntries(def.fields.filter((f) => str(sp[f.name])).map((f) => [f.name, str(sp[f.name])!]));
  const newHref = `/admin/manage/${def.key}/new`;

  const columns: Column<Record<string, unknown>>[] = def.columns.map((c, i) => ({
    key: c,
    header: fieldByName[c]?.label ?? c.replace(/([A-Z])/g, " $1").replace(/^\w/, (x) => x.toUpperCase()),
    sortKey: c,
    align: ["credits", "number"].includes(fieldByName[c]?.type ?? "") ? "right" : undefined,
    cell: (row) =>
      i === 0 ? (
        <Link href={resourceHref(def, String(row[def.pk]))} className="font-medium text-primary hover:underline">
          {formatCell(fieldByName[c], c, row[c], data.labels)}
        </Link>
      ) : (
        formatCell(fieldByName[c], c, row[c], data.labels)
      ),
  }));

  return (
    <AdminPage
      title={def.label}
      description={def.description}
      actions={
        <Button asChild>
          <Link href={withQuery(newHref, {}, presetQuery)}>
            <Plus /> New {def.singular.toLowerCase()}
          </Link>
        </Button>
      }
    >
      {(filterFields.length > 0 || def.searchFields) && (
        <FilterBar basePath={basePath}>
          {def.searchFields && <FilterInput name="q" label="Search" value={str(sp.q)} placeholder={`Search ${def.label.toLowerCase()}`} />}
          {filterFields.map((f) => (
            <FilterSelect
              key={f.name}
              name={f.name}
              label={f.label}
              value={str(sp[f.name])}
              options={f.type === "select" ? (f.options ?? []) : (data.options[f.relation as RelationKey] ?? [])}
            />
          ))}
        </FilterBar>
      )}
      <DataTable rows={data.rows} columns={columns} sp={sp} basePath={basePath} rowKey={(r) => String(r[def.pk])} empty={`No ${def.label.toLowerCase()} yet`} />
      <Pagination page={data.page} hasMore={data.hasMore} sp={sp} basePath={basePath} />
    </AdminPage>
  );
}
