import { and, desc, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { bigBoxOpenings, bigMysteryBoxes, gameEvents, inventory, items, maps, userMapProgress } from "@/db/schema";

export type GameEventType = (typeof gameEvents.$inferInsert)["type"];

/** Appends an immutable audit event. Duplicate (type, actionId) pairs are ignored so retries never double-record. */
export async function recordEvent(
  tx: DbOrTx,
  e: {
    userId: string;
    type: GameEventType;
    actionId: string;
    level?: number | null;
    refType?: string;
    refId?: string;
    config?: Record<string, unknown>;
    result?: Record<string, unknown>;
    ledgerTransactionId?: string | null;
  },
) {
  await tx
    .insert(gameEvents)
    .values({
      userId: e.userId,
      type: e.type,
      actionId: e.actionId,
      level: e.level ?? null,
      refType: e.refType,
      refId: e.refId,
      config: e.config ?? {},
      result: e.result ?? {},
      ledgerTransactionId: e.ledgerTransactionId ?? null,
    })
    .onConflictDoNothing();
}

/** Levels of every adventure map this player has completed. */
export async function completedMapLevels(tx: DbOrTx, userId: string): Promise<Set<number>> {
  const rows = await tx
    .select({ level: userMapProgress.level })
    .from(userMapProgress)
    .where(and(eq(userMapProgress.userId, userId), isNotNull(userMapProgress.completedAt)));
  return new Set(rows.map((r) => r.level));
}

/** Total Loot ever collected per map level (milestone model: Loot is never consumed). */
export async function lootCollectedByLevel(tx: DbOrTx, userId: string): Promise<Map<number, number>> {
  const rows = await tx
    .select({ level: items.adventureLevel, n: sql<number>`coalesce(sum(${inventory.totalAcquired}), 0)::int` })
    .from(inventory)
    .innerJoin(items, eq(items.id, inventory.itemId))
    .where(and(eq(inventory.userId, userId), eq(items.kind, "LOOT"), isNotNull(items.adventureLevel), gt(inventory.totalAcquired, 0)))
    .groupBy(items.adventureLevel);
  return new Map(rows.map((r) => [r.level as number, Number(r.n)]));
}

export async function lootCollected(tx: DbOrTx, userId: string, level: number) {
  return (await lootCollectedByLevel(tx, userId)).get(level) ?? 0;
}

/**
 * Whether the previous map has been won: its final checkpoint is reached and its Big Mystery Box
 * opened (or it has no active Big Mystery Box). Winning it is what unlocks the next map.
 */
export async function mapWon(tx: DbOrTx, userId: string, map: { id: string }) {
  const [[prog], [bb], [opening]] = await Promise.all([
    tx
      .select({ completedAt: userMapProgress.completedAt })
      .from(userMapProgress)
      .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)))
      .limit(1),
    tx.select({ active: bigMysteryBoxes.active }).from(bigMysteryBoxes).where(eq(bigMysteryBoxes.mapId, map.id)).limit(1),
    tx
      .select({ id: bigBoxOpenings.id })
      .from(bigBoxOpenings)
      .where(and(eq(bigBoxOpenings.userId, userId), eq(bigBoxOpenings.mapId, map.id)))
      .limit(1),
  ]);
  return Boolean(prog?.completedAt) && (Boolean(opening) || !bb?.active);
}

/**
 * Explains why a box is locked, or returns null when the player may open it. A level's box opens
 * together with that level's map and stays open for good, so players can keep opening it.
 */
export async function boxLockReason(tx: DbOrTx, userId: string, box: { level: number | null; requiresMapLevel: number | null }): Promise<string | null> {
  if (box.level !== null) {
    const [map] = await tx
      .select({ id: maps.id, name: maps.name })
      .from(maps)
      .where(and(eq(maps.level, box.level), eq(maps.status, "PUBLISHED")))
      .limit(1);
    if (map) {
      const [[prog], [prev]] = await Promise.all([
        tx
          .select({ level: userMapProgress.level })
          .from(userMapProgress)
          .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)))
          .limit(1),
        tx
          .select({ id: maps.id, level: maps.level })
          .from(maps)
          .where(and(eq(maps.status, "PUBLISHED"), isNotNull(maps.level), lt(maps.level, box.level)))
          .orderBy(desc(maps.level))
          .limit(1),
      ]);
      if (prog || !prev) return null;
      return (await mapWon(tx, userId, prev))
        ? `Unlock Map ${box.level} (${map.name}) to open this box`
        : `Win the Big Mystery Box on Map ${prev.level} to unlock Map ${box.level} and this box`;
    }
  }
  if (box.requiresMapLevel === null || (await completedMapLevels(tx, userId)).has(box.requiresMapLevel)) return null;
  const [map] = await tx.select({ name: maps.name }).from(maps).where(eq(maps.level, box.requiresMapLevel)).limit(1);
  return `Complete Map ${box.requiresMapLevel}${map ? ` (${map.name})` : ""} to unlock this box`;
}
