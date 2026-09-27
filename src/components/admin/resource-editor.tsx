import { RESOURCES, type RelationKey, type ResourceDef, type ResourceKey } from "@/lib/admin/resource-fields";
import { fetchResourceRow, relationOptions, serializeRow } from "@/server/admin/resources";
import { ResourceForm } from "./resource-form";

/** Server wrapper that loads a registry record and renders its audited edit form inline on a detail page. */
export async function ResourceEditor({ resource, id, back, afterDelete }: { resource: ResourceKey; id: string; back: string; afterDelete?: string }) {
  const def: ResourceDef = RESOURCES[resource];
  const [row, options] = await Promise.all([
    fetchResourceRow(resource, id),
    relationOptions(def.fields.filter((f) => f.type === "relation").map((f) => f.relation as RelationKey)),
  ]);
  return (
    <ResourceForm
      resourceKey={resource}
      singular={def.singular}
      fields={def.fields}
      id={id}
      initial={serializeRow(row)}
      options={options}
      significant={def.significant}
      deletable={def.deletable}
      afterSave={back}
      afterDelete={afterDelete ?? `/admin/manage/${resource}`}
    />
  );
}
