import { and, asc, eq, sql } from "drizzle-orm";
import type { DbOrTx, Tx } from "@/db";
import {
  areaUnlocks,
  collectionCompletions,
  collections,
  items,
  mapAreas,
  requirements,
  tileDiscoveries,
} from "@/db/schema";
import { collectionProgress, consumeItem, itemQuantity } from "./inventory";

export type RequirementStatus = {
  id: string;
  type: (typeof requirements.$inferSelect)["type"];
  label: string;
  icon: string;
  current: number;
  required: number;
  met: boolean;
  consume: boolean;
  itemId: string | null;
};

export async function isAreaAccessible(tx: DbOrTx, userId: string, areaId: string): Promise<boolean> {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(requirements)
    .where(and(eq(requirements.ownerType, "AREA"), eq(requirements.ownerId, areaId)));
  if (n === 0) return true;
  const [unlock] = await tx
    .select({ id: areaUnlocks.id })
    .from(areaUnlocks)
    .where(and(eq(areaUnlocks.userId, userId), eq(areaUnlocks.areaId, areaId)))
    .limit(1);
  return Boolean(unlock);
}

/** Evaluates configured requirements server-side. Never trust a client-side view of eligibility. */
export async function evaluateRequirements(
  tx: DbOrTx,
  userId: string,
  ownerType: "AREA" | "VAULT",
  ownerId: string,
): Promise<RequirementStatus[]> {
  const reqs = await tx
    .select()
    .from(requirements)
    .where(and(eq(requirements.ownerType, ownerType), eq(requirements.ownerId, ownerId)))
    .orderBy(asc(requirements.sortOrder));
  const out: RequirementStatus[] = [];
  for (const r of reqs) {
    let current = 0;
    let required = r.quantity;
    let icon = "✔️";
    switch (r.type) {
      case "ITEM": {
        if (r.itemId) {
          current = await itemQuantity(tx, userId, r.itemId);
          const [item] = await tx.select({ icon: items.icon }).from(items).where(eq(items.id, r.itemId)).limit(1);
          icon = item?.icon ?? "🎁";
        }
        break;
      }
      case "COLLECTION_COMPLETE":
      case "COLLECTION_PROGRESS": {
        if (r.collectionId) {
          const progress = await collectionProgress(tx, userId, r.collectionId);
          const [col] = await tx.select({ icon: collections.icon }).from(collections).where(eq(collections.id, r.collectionId)).limit(1);
          icon = col?.icon ?? "📚";
          if (r.type === "COLLECTION_COMPLETE") {
            const [done] = await tx
              .select({ id: collectionCompletions.id })
              .from(collectionCompletions)
              .where(and(eq(collectionCompletions.userId, userId), eq(collectionCompletions.collectionId, r.collectionId)))
              .limit(1);
            required = progress.total;
            current = done ? progress.total : progress.owned;
          } else {
            current = progress.owned;
          }
        }
        break;
      }
      case "AREA_UNLOCKED": {
        if (r.areaId) {
          current = (await isAreaAccessible(tx, userId, r.areaId)) ? 1 : 0;
          const [area] = await tx.select({ icon: mapAreas.icon }).from(mapAreas).where(eq(mapAreas.id, r.areaId)).limit(1);
          icon = area?.icon ?? "🗺️";
        }
        required = 1;
        break;
      }
      case "AREA_TILES": {
        if (r.areaId) {
          const [{ n }] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(tileDiscoveries)
            .where(and(eq(tileDiscoveries.userId, userId), eq(tileDiscoveries.areaId, r.areaId)));
          current = n;
          const [area] = await tx.select({ icon: mapAreas.icon }).from(mapAreas).where(eq(mapAreas.id, r.areaId)).limit(1);
          icon = area?.icon ?? "🧭";
        }
        break;
      }
    }
    out.push({
      id: r.id,
      type: r.type,
      label: r.label,
      icon,
      current,
      required,
      met: current >= required && required > 0,
      consume: r.consume,
      itemId: r.itemId,
    });
  }
  return out;
}

export async function consumeRequirements(tx: Tx, userId: string, statuses: RequirementStatus[], ctx: { sourceType: string; sourceId: string }) {
  const consumed: { itemId: string; quantity: number }[] = [];
  for (const s of statuses) {
    if (s.type === "ITEM" && s.consume && s.itemId) {
      await consumeItem(tx, userId, s.itemId, s.required, { ...ctx, reason: `Used for ${ctx.sourceType}` });
      consumed.push({ itemId: s.itemId, quantity: s.required });
    }
  }
  return consumed;
}
