import { and, eq, gt, gte, sql } from "drizzle-orm";
import type { DbOrTx, Tx } from "@/db";
import { collectionCompletions, collections, inventory, inventoryEvents, items } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { checkAchievements } from "./achievements";
import { trackMission } from "./daily";
import { notify } from "./notifications";
import { grantPool, type RewardResult } from "./rewards";

type Ctx = { sourceType: string; sourceId?: string; reason: string; skipMission?: boolean };

/** Adds items to a user's inventory, auto-assembling fragments and completing collections where configured. */
export async function grantItem(tx: Tx, userId: string, itemId: string, qty: number, ctx: Ctx, depth = 0) {
  if (qty <= 0) return;
  const [item] = await tx.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) throw new AppError("Item not found", "ITEM_NOT_FOUND", 500);

  const [before] = await tx
    .select({ totalAcquired: inventory.totalAcquired })
    .from(inventory)
    .where(and(eq(inventory.userId, userId), eq(inventory.itemId, itemId)))
    .limit(1);

  const [row] = await tx
    .insert(inventory)
    .values({ userId, itemId, quantity: qty, totalAcquired: qty })
    .onConflictDoUpdate({
      target: [inventory.userId, inventory.itemId],
      set: {
        quantity: sql`${inventory.quantity} + ${qty}`,
        totalAcquired: sql`${inventory.totalAcquired} + ${qty}`,
        updatedAt: new Date(),
      },
    })
    .returning();

  await tx.insert(inventoryEvents).values({
    userId,
    itemId,
    delta: qty,
    reason: ctx.reason,
    sourceType: ctx.sourceType,
    sourceId: ctx.sourceId,
  });

  if (!ctx.skipMission) await trackMission(tx, userId, "COLLECT_ITEM", qty);

  const firstTime = !before || before.totalAcquired === 0;
  if (firstTime) await checkAchievements(tx, userId, "ITEMS_COLLECTED");

  if (item.kind === "FRAGMENT" && item.assemblesIntoItemId && depth < 3) {
    const [parent] = await tx.select().from(items).where(eq(items.id, item.assemblesIntoItemId)).limit(1);
    const required = parent?.fragmentsRequired ?? 0;
    const count = parent && item.autoAssemble && required > 0 ? Math.floor(row.quantity / required) : 0;
    if (parent && count > 0) {
      await consumeItem(tx, userId, item.id, required * count, { sourceType: "assembly", sourceId: parent.id, reason: `Assembled ${parent.name}` });
      await grantItem(tx, userId, parent.id, count, { sourceType: "assembly", sourceId: item.id, reason: `Assembled from ${required} fragments` }, depth + 1);
      await notify(tx, userId, "COLLECTION", `${parent.icon} ${parent.name} assembled!`, `You combined ${required} fragments into ${parent.name}.`, "/collections");
    }
  }

  if (firstTime && item.collectionId) {
    await checkCollectionCompletion(tx, userId, item.collectionId);
  }
}

export async function consumeItem(tx: Tx, userId: string, itemId: string, qty: number, ctx: Ctx) {
  const [row] = await tx
    .update(inventory)
    .set({ quantity: sql`${inventory.quantity} - ${qty}`, updatedAt: new Date() })
    .where(and(eq(inventory.userId, userId), eq(inventory.itemId, itemId), gte(inventory.quantity, qty)))
    .returning();
  if (!row) throw new AppError("You don't have enough of a required item", "ITEM_INSUFFICIENT");
  await tx.insert(inventoryEvents).values({ userId, itemId, delta: -qty, reason: ctx.reason, sourceType: ctx.sourceType, sourceId: ctx.sourceId });
}

/** Puts back items that left the inventory temporarily (e.g. market escrow) without counting them as newly acquired. */
export async function returnItem(tx: Tx, userId: string, itemId: string, qty: number, ctx: Ctx) {
  if (qty <= 0) return;
  await tx
    .insert(inventory)
    .values({ userId, itemId, quantity: qty, totalAcquired: 0 })
    .onConflictDoUpdate({
      target: [inventory.userId, inventory.itemId],
      set: { quantity: sql`${inventory.quantity} + ${qty}`, updatedAt: new Date() },
    });
  await tx.insert(inventoryEvents).values({ userId, itemId, delta: qty, reason: ctx.reason, sourceType: ctx.sourceType, sourceId: ctx.sourceId });
}

export async function itemQuantity(tx: DbOrTx, userId: string, itemId: string): Promise<number> {
  const [row] = await tx
    .select({ q: inventory.quantity })
    .from(inventory)
    .where(and(eq(inventory.userId, userId), eq(inventory.itemId, itemId)))
    .limit(1);
  return row?.q ?? 0;
}

export async function collectionProgress(tx: DbOrTx, userId: string, collectionId: string) {
  const [totals] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(items)
    .where(and(eq(items.collectionId, collectionId), eq(items.status, "PUBLISHED")));
  const [owned] = await tx
    .select({ owned: sql<number>`count(*)::int` })
    .from(inventory)
    .innerJoin(items, eq(items.id, inventory.itemId))
    .where(
      and(
        eq(inventory.userId, userId),
        eq(items.collectionId, collectionId),
        eq(items.status, "PUBLISHED"),
        gt(inventory.totalAcquired, 0),
      ),
    );
  return { owned: owned?.owned ?? 0, total: totals?.total ?? 0 };
}

export async function checkCollectionCompletion(tx: Tx, userId: string, collectionId: string): Promise<RewardResult[] | null> {
  const [col] = await tx.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
  if (!col || col.status !== "PUBLISHED") return null;
  const { owned, total } = await collectionProgress(tx, userId, collectionId);
  if (total === 0 || owned < total) return null;
  const inserted = await tx
    .insert(collectionCompletions)
    .values({ userId, collectionId })
    .onConflictDoNothing()
    .returning({ id: collectionCompletions.id });
  if (inserted.length === 0) return null;
  const rewards = await grantPool(tx, userId, col.completionRewardPoolId, {
    sourceType: "collection",
    sourceId: col.id,
    key: `collection:${userId}:${col.id}`,
  });
  await tx.update(collectionCompletions).set({ rewards }).where(eq(collectionCompletions.id, inserted[0].id));
  await notify(
    tx,
    userId,
    "COLLECTION",
    `${col.icon} ${col.name} complete!`,
    rewards.length ? `Completion reward: ${rewards.map((r) => r.display).join(", ")}.` : "You completed the collection.",
    "/collections",
  );
  await checkAchievements(tx, userId, "COLLECTIONS_COMPLETED");
  return rewards;
}
