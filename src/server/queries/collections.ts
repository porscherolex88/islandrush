import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { collectionCompletions, collections, inventory, items } from "@/db/schema";
import { poolOdds } from "@/server/services/mystery-box";

export type ItemView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  kind: string;
  rarity: string;
  purpose: string;
  effect: string;
  quantity: number;
  totalAcquired: number;
  fragmentsRequired: number | null;
  assemblesInto: { name: string; icon: string } | null;
};

async function itemViews(userId: string, where: ReturnType<typeof eq> | undefined) {
  const rows = await db
    .select({ item: items, quantity: inventory.quantity, totalAcquired: inventory.totalAcquired })
    .from(items)
    .leftJoin(inventory, and(eq(inventory.itemId, items.id), eq(inventory.userId, userId)))
    .where(and(eq(items.status, "PUBLISHED"), where))
    .orderBy(asc(items.sortOrder), asc(items.name));
  const all = await db.select({ id: items.id, name: items.name, icon: items.icon }).from(items);
  return rows.map<ItemView>(({ item, quantity, totalAcquired }) => {
    const target = item.assemblesIntoItemId ? all.find((i) => i.id === item.assemblesIntoItemId) : null;
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description,
      icon: item.icon,
      kind: item.kind,
      rarity: item.rarity,
      purpose: item.purpose,
      effect: item.effect,
      quantity: quantity ?? 0,
      totalAcquired: totalAcquired ?? 0,
      fragmentsRequired: item.fragmentsRequired,
      assemblesInto: target ? { name: target.name, icon: target.icon } : null,
    };
  });
}

export async function getCollectionsOverview(userId: string) {
  const cols = await db.select().from(collections).where(eq(collections.status, "PUBLISHED")).orderBy(asc(collections.sortOrder));
  const completions = await db.select().from(collectionCompletions).where(eq(collectionCompletions.userId, userId));
  const allItems = await itemViews(userId, undefined);
  const byCollection = await db.select({ id: items.id, collectionId: items.collectionId }).from(items).where(eq(items.status, "PUBLISHED"));
  const inCollection = new Set(byCollection.filter((i) => i.collectionId).map((i) => i.id));

  const overview = cols.map((c) => {
    const ids = byCollection.filter((i) => i.collectionId === c.id).map((i) => i.id);
    const its = allItems.filter((i) => ids.includes(i.id));
    const completion = completions.find((x) => x.collectionId === c.id);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      icon: c.icon,
      color: c.color,
      owned: its.filter((i) => i.totalAcquired > 0).length,
      total: its.length,
      completedAt: completion?.createdAt ?? null,
      preview: its.slice(0, 6).map((i) => ({ id: i.id, icon: i.icon, owned: i.totalAcquired > 0 })),
    };
  });
  const other = allItems.filter((i) => !inCollection.has(i.id));
  return {
    collections: overview,
    specials: other.filter((i) => i.kind === "SPECIAL" || i.kind === "KEY" || i.kind === "COSMETIC"),
    fragments: other.filter((i) => i.kind === "FRAGMENT").concat(allItems.filter((i) => inCollection.has(i.id) && i.kind === "FRAGMENT")),
  };
}

export async function getCollectionDetail(userId: string, slug: string) {
  const [col] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.status, "PUBLISHED")))
    .limit(1);
  if (!col) return null;
  const its = await itemViews(userId, eq(items.collectionId, col.id));
  const [completion] = await db
    .select()
    .from(collectionCompletions)
    .where(and(eq(collectionCompletions.userId, userId), eq(collectionCompletions.collectionId, col.id)))
    .limit(1);
  const prizes = col.completionRewardPoolId ? await poolOdds(col.completionRewardPoolId) : [];
  return { collection: col, items: its, completion: completion ?? null, prizes };
}
