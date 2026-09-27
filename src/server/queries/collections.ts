import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { collectionCompletions, collections, inventory, items, mapAreas, mysteryBoxes, requirements, rewardPoolEntries, vaults } from "@/db/schema";
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
  /** Where the item can be found, in plain words. */
  sources: string[];
};

/** Maps each item to the places it can drop from: boxes, map areas, vaults, collections, or assembly. */
async function itemSources() {
  const [entries, boxes, areas, vs, cols, frags] = await Promise.all([
    db.select({ poolId: rewardPoolEntries.poolId, itemId: rewardPoolEntries.itemId }).from(rewardPoolEntries).where(isNotNull(rewardPoolEntries.itemId)),
    db.select({ name: mysteryBoxes.name, poolId: mysteryBoxes.rewardPoolId }).from(mysteryBoxes).where(eq(mysteryBoxes.status, "PUBLISHED")),
    db.select({ name: mapAreas.name, poolId: mapAreas.discoveryPoolId, unlockPoolId: mapAreas.unlockRewardPoolId }).from(mapAreas).where(eq(mapAreas.status, "PUBLISHED")),
    db.select({ name: vaults.name, poolId: vaults.rewardPoolId }).from(vaults),
    db.select({ name: collections.name, poolId: collections.completionRewardPoolId }).from(collections),
    db.select({ name: items.name, target: items.assemblesIntoItemId, n: items.fragmentsRequired }).from(items).where(isNotNull(items.assemblesIntoItemId)),
  ]);
  const poolNames = new Map<string, string[]>();
  const add = (poolId: string | null, label: string) => {
    if (!poolId) return;
    poolNames.set(poolId, [...(poolNames.get(poolId) ?? []), label]);
  };
  boxes.forEach((b) => add(b.poolId, b.name));
  areas.forEach((a) => {
    add(a.poolId, `${a.name} on the Map`);
    add(a.unlockPoolId, `Unlocking the ${a.name}`);
  });
  vs.forEach((v) => add(v.poolId, v.name));
  cols.forEach((c) => add(c.poolId, `Completing ${c.name}`));
  const out = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!e.itemId) continue;
    const set = out.get(e.itemId) ?? new Set<string>();
    (poolNames.get(e.poolId) ?? []).forEach((n) => set.add(n));
    out.set(e.itemId, set);
  }
  for (const f of frags) {
    if (!f.target) continue;
    const set = out.get(f.target) ?? new Set<string>();
    set.add(`Assemble ${f.n ?? ""} ${f.name}s`.replace(/\s+/g, " "));
    out.set(f.target, set);
  }
  return out;
}

async function itemViews(userId: string, where: ReturnType<typeof eq> | undefined) {
  const rows = await db
    .select({ item: items, quantity: inventory.quantity, totalAcquired: inventory.totalAcquired })
    .from(items)
    .leftJoin(inventory, and(eq(inventory.itemId, items.id), eq(inventory.userId, userId)))
    .where(and(eq(items.status, "PUBLISHED"), where))
    .orderBy(asc(items.sortOrder), asc(items.name));
  const [all, sources] = await Promise.all([db.select({ id: items.id, name: items.name, icon: items.icon }).from(items), itemSources()]);
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
      sources: [...(sources.get(item.id) ?? [])],
    };
  });
}

/** Areas and vaults that need progress in a collection, e.g. "8 of these 10 relics unlock the Temple". */
async function collectionUnlocks() {
  const [reqs, areas, vs] = await Promise.all([
    db.select({ ownerType: requirements.ownerType, ownerId: requirements.ownerId, type: requirements.type, collectionId: requirements.collectionId, quantity: requirements.quantity }).from(requirements).where(isNotNull(requirements.collectionId)),
    db.select({ id: mapAreas.id, name: mapAreas.name }).from(mapAreas),
    db.select({ id: vaults.id, name: vaults.name }).from(vaults),
  ]);
  return reqs.map((r) => ({
    collectionId: r.collectionId!,
    target: (r.ownerType === "AREA" ? areas : vs).find((o) => o.id === r.ownerId)?.name ?? "the next area",
    complete: r.type === "COLLECTION_COMPLETE",
    required: r.quantity,
  }));
}

export type CollectionUnlock = Awaited<ReturnType<typeof collectionUnlocks>>[number];

export async function getCollectionsOverview(userId: string) {
  const cols = await db.select().from(collections).where(eq(collections.status, "PUBLISHED")).orderBy(asc(collections.sortOrder));
  const completions = await db.select().from(collectionCompletions).where(eq(collectionCompletions.userId, userId));
  const allItems = await itemViews(userId, undefined);
  const byCollection = await db.select({ id: items.id, collectionId: items.collectionId }).from(items).where(eq(items.status, "PUBLISHED"));
  const inCollection = new Set(byCollection.filter((i) => i.collectionId).map((i) => i.id));
  const unlocks = await collectionUnlocks();

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
      items: its,
      unlocks: unlocks.filter((u) => u.collectionId === c.id),
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
  const [prizes, unlocks] = await Promise.all([col.completionRewardPoolId ? poolOdds(col.completionRewardPoolId) : [], collectionUnlocks()]);
  return { collection: col, items: its, completion: completion ?? null, prizes, unlocks: unlocks.filter((u) => u.collectionId === col.id) };
}
