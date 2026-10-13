import { and, asc, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { gameEvents, inventory, items, mapCheckpoints, maps, userCheckpoints, userMapProgress } from "@/db/schema";

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

/** The adventure level the player is working on: the lowest published map they haven't completed. */
export async function currentAdventureLevel(tx: DbOrTx, userId: string): Promise<number | null> {
  const [levels, done] = await Promise.all([
    tx.select({ level: maps.level }).from(maps).where(and(eq(maps.status, "PUBLISHED"), isNotNull(maps.level))).orderBy(asc(maps.level)),
    completedMapLevels(tx, userId),
  ]);
  return (levels.find((m) => !done.has(m.level as number))?.level as number | undefined) ?? null;
}

/**
 * What a Free unlock grants on a map level: enough of the map's primary Loot to reach the next
 * milestone above the player's total (the map unlock, then each checkpoint chest in order).
 * Returns null when nothing is left to unlock on that map.
 */
export async function freeUnlockFill(tx: DbOrTx, userId: string, level: number) {
  const [map] = await tx
    .select()
    .from(maps)
    .where(and(eq(maps.level, level), eq(maps.status, "PUBLISHED")))
    .limit(1);
  if (!map) return null;
  const [[prev], [progress], cps, done, [item], loot] = await Promise.all([
    tx
      .select({ id: maps.id })
      .from(maps)
      .where(and(eq(maps.status, "PUBLISHED"), isNotNull(maps.level), lt(maps.level, level)))
      .limit(1),
    tx
      .select({ completedAt: userMapProgress.completedAt })
      .from(userMapProgress)
      .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)))
      .limit(1),
    tx
      .select({ id: mapCheckpoints.id, lootRequired: mapCheckpoints.lootRequired })
      .from(mapCheckpoints)
      .where(and(eq(mapCheckpoints.mapId, map.id), eq(mapCheckpoints.status, "PUBLISHED"))),
    tx.select({ id: userCheckpoints.checkpointId }).from(userCheckpoints).where(and(eq(userCheckpoints.userId, userId), eq(userCheckpoints.mapId, map.id))),
    tx
      .select({ id: items.id, name: items.name, icon: items.icon })
      .from(items)
      .where(and(eq(items.kind, "LOOT"), eq(items.adventureLevel, level), eq(items.status, "PUBLISHED")))
      .orderBy(asc(items.sortOrder))
      .limit(1),
    lootCollected(tx, userId, level),
  ]);
  if (!item || progress?.completedAt) return null;
  const doneIds = new Set(done.map((d) => d.id));
  const milestones = cps.filter((c) => !doneIds.has(c.id)).map((c) => c.lootRequired);
  if (prev && !progress) milestones.push(map.lootRequired);
  const target = Math.min(...milestones.filter((m) => m > loot));
  if (!Number.isFinite(target)) return null;
  return { item, mapName: map.name, need: target - loot };
}

/** Explains why a box level is locked, or returns null when the player may open it. */
export async function boxLockReason(tx: DbOrTx, userId: string, box: { level: number | null; requiresMapLevel: number | null }): Promise<string | null> {
  if (box.level === null && box.requiresMapLevel === null) return null;
  const done = await completedMapLevels(tx, userId);
  // A level's box retires once its map is complete: its Loot can no longer move the player forward.
  if (box.level !== null && done.has(box.level)) return `You've completed Map ${box.level}. Continue your adventure with the next Mystery Box.`;
  if (box.requiresMapLevel === null || done.has(box.requiresMapLevel)) return null;
  const [map] = await tx.select({ name: maps.name }).from(maps).where(eq(maps.level, box.requiresMapLevel)).limit(1);
  return `Complete Map ${box.requiresMapLevel}${map ? ` (${map.name})` : ""} to unlock this box`;
}
