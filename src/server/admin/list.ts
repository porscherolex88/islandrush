import "server-only";
import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { RelationKey } from "@/lib/admin/resource-fields";
import { loadResource, relationOptions, type Option } from "./resources";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export const PAGE_SIZE = 50;

/** Lists a registry resource with equality filters on select/relation fields, text search and sorting. */
export async function listResource(key: string, sp: SP) {
  const r = loadResource(key);
  if (!r) return null;
  const { def, table, columns } = r;
  const conds: SQL[] = [];
  for (const f of def.fields) {
    const v = first(sp[f.name]);
    if (v && (f.type === "select" || f.type === "relation") && columns[f.name]) conds.push(eq(columns[f.name], v));
    if (v && f.type === "boolean" && columns[f.name]) conds.push(eq(columns[f.name], v === "true"));
  }
  const q = first(sp.q)?.trim();
  if (q && def.searchFields?.length) {
    const ors = def.searchFields.filter((f) => columns[f]).map((f) => ilike(columns[f], `%${q.replace(/[%_]/g, "\\$&")}%`));
    if (ors.length) conds.push(or(...ors)!);
  }
  const sortKey = first(sp.sort);
  const dir = first(sp.dir) === "asc" ? asc : desc;
  const orderBy =
    sortKey && columns[sortKey]
      ? [dir(columns[sortKey])]
      : columns.sortOrder
        ? [asc(columns.sortOrder)]
        : columns.day
          ? [desc(columns.day)]
          : columns.createdAt
            ? [desc(columns.createdAt)]
            : columns.updatedAt
              ? [desc(columns.updatedAt)]
              : [asc(r.pkColumn)];
  const page = Math.max(1, Number(first(sp.page) ?? 1) || 1);
  const rows = (await db
    .select()
    .from(table)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE)) as Record<string, unknown>[];
  const relKeys = def.fields.filter((f) => f.type === "relation" && (def.columns.includes(f.name) || first(sp[f.name]))).map((f) => f.relation!) as RelationKey[];
  const filterKeys = def.fields.filter((f) => f.type === "relation" && ["poolId", "areaId", "mapId", "collectionId", "ownerId"].includes(f.name)).map((f) => f.relation!) as RelationKey[];
  const options = await relationOptions([...relKeys, ...filterKeys]);
  const labels: Record<string, Record<string, string>> = {};
  for (const [k, opts] of Object.entries(options)) labels[k] = Object.fromEntries((opts as Option[]).map((o) => [o.value, o.label]));
  return { def, rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, page, options, labels };
}
