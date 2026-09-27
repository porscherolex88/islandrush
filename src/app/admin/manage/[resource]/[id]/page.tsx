import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceForm } from "@/components/admin/resource-form";
import { AdminCard, AdminPage, str } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { getResourceDef, resourceHref, type RelationKey } from "@/lib/admin/resource-fields";
import { requireAdmin } from "@/lib/auth/session";
import { fetchResourceRow, relationOptions, serializeRow } from "@/server/admin/resources";

export async function generateMetadata({ params }: PageProps<"/admin/manage/[resource]/[id]">): Promise<Metadata> {
  const { resource, id } = await params;
  const def = getResourceDef(resource);
  return { title: def ? `${id === "new" ? "New" : "Edit"} ${def.singular.toLowerCase()}` : "Manage" };
}

export default async function ResourceEditPage({ params, searchParams }: PageProps<"/admin/manage/[resource]/[id]">) {
  const [{ resource, id }, sp] = await Promise.all([params, searchParams]);
  const def = getResourceDef(resource);
  if (!def) notFound();
  await requireAdmin(def.permission);
  const isNew = id === "new";
  const row = isNew ? null : await fetchResourceRow(resource, id).catch(() => null);
  if (!isNew && !row) notFound();
  const options = await relationOptions(def.fields.filter((f) => f.type === "relation").map((f) => f.relation as RelationKey));
  const preset = Object.fromEntries(def.fields.filter((f) => str(sp[f.name]) !== undefined).map((f) => [f.name, str(sp[f.name])]));
  const back = str(sp.back) ?? `/admin/manage/${resource}`;
  const safeBack = back.startsWith("/admin") ? back : `/admin/manage/${resource}`;
  const title = isNew ? `New ${def.singular.toLowerCase()}` : String(row?.name ?? row?.title ?? row?.label ?? row?.question ?? row?.key ?? def.singular);

  return (
    <AdminPage
      title={title}
      description={def.significant ? "Changes to this record are economically significant and require a reason." : def.description}
      actions={
        <Button asChild variant="outline">
          <Link href={safeBack}>Back</Link>
        </Button>
      }
    >
      <AdminCard>
        <ResourceForm
          resourceKey={resource}
          singular={def.singular}
          fields={def.fields}
          id={isNew ? null : id}
          initial={serializeRow(row)}
          options={options}
          significant={def.significant}
          deletable={def.deletable}
          preset={preset}
          afterSave={str(sp.back)?.startsWith("/admin") ? str(sp.back)! : def.detailPath ? resourceHref(def, ":id") : `/admin/manage/${resource}`}
          afterDelete={safeBack}
        />
      </AdminCard>
    </AdminPage>
  );
}
