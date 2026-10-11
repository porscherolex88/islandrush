import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { areaUnlocks, mapAreas, mapTiles, maps, requirements, tileDiscoveries } from "@/db/schema";
import { AppError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { checkAchievements } from "./achievements";
import { freeDiscoveriesUsed, getDailyPlan, today, trackMission } from "./daily";
import { assertWithinSpendLimit, lockPlayer } from "./guards";
import { getBalances, postTransaction } from "./ledger";
import { notify } from "./notifications";
import { consumeRequirements, evaluateRequirements, isAreaAccessible, type RequirementStatus } from "./requirements";
import { grantPool, grantReward, pickPoolEntry, type RewardResult } from "./rewards";

export async function getPrimaryMap() {
  const [map] = await db.select().from(maps).where(eq(maps.status, "PUBLISHED")).orderBy(asc(maps.createdAt)).limit(1);
  return map ?? null;
}

export type AreaView = typeof mapAreas.$inferSelect & {
  accessible: boolean;
  unlocked: boolean;
  requirements: RequirementStatus[];
  canUnlock: boolean;
  tiles: (typeof mapTiles.$inferSelect & { discovered: boolean; reward: RewardResult | null; cost: number })[];
  discoveredCount: number;
};

export async function getMapState(userId: string, mapId?: string) {
  const map = mapId ? (await db.select().from(maps).where(eq(maps.id, mapId)).limit(1))[0] : await getPrimaryMap();
  if (!map) return null;
  const areas = await db
    .select()
    .from(mapAreas)
    .where(and(eq(mapAreas.mapId, map.id), eq(mapAreas.status, "PUBLISHED")))
    .orderBy(asc(mapAreas.sortOrder));
  const areaIds = areas.map((a) => a.id);
  const [tiles, discoveries, unlocks, reqCounts] = await Promise.all([
    areaIds.length
      ? db.select().from(mapTiles).where(and(inArray(mapTiles.areaId, areaIds), eq(mapTiles.status, "PUBLISHED"))).orderBy(asc(mapTiles.row), asc(mapTiles.col))
      : [],
    db.select().from(tileDiscoveries).where(eq(tileDiscoveries.userId, userId)),
    db.select().from(areaUnlocks).where(eq(areaUnlocks.userId, userId)),
    areaIds.length
      ? db
          .select({ ownerId: requirements.ownerId, n: sql<number>`count(*)::int` })
          .from(requirements)
          .where(and(eq(requirements.ownerType, "AREA"), inArray(requirements.ownerId, areaIds)))
          .groupBy(requirements.ownerId)
      : [],
  ]);

  const views: AreaView[] = [];
  for (const area of areas) {
    const hasReqs = (reqCounts.find((r) => r.ownerId === area.id)?.n ?? 0) > 0;
    const unlocked = unlocks.some((u) => u.areaId === area.id);
    const accessible = !hasReqs || unlocked;
    const reqStatus = hasReqs && !unlocked ? await evaluateRequirements(db, userId, "AREA", area.id) : [];
    const areaTiles = tiles
      .filter((t) => t.areaId === area.id)
      .map((t) => {
        const d = discoveries.find((x) => x.tileId === t.id);
        return {
          ...t,
          discovered: Boolean(d),
          reward: d ? (d.reward as RewardResult) : null,
          cost: t.costCreditsOverride ?? area.discoveryCostCredits,
        };
      });
    views.push({
      ...area,
      accessible,
      unlocked,
      requirements: reqStatus,
      canUnlock: hasReqs && !unlocked && reqStatus.length > 0 && reqStatus.every((r) => r.met),
      tiles: areaTiles,
      discoveredCount: areaTiles.filter((t) => t.discovered).length,
    });
  }
  const totalTiles = views.reduce((s, a) => s + a.tiles.length, 0);
  const discovered = views.reduce((s, a) => s + a.discoveredCount, 0);
  return { map, areas: views, totalTiles, discovered };
}

export type DiscoveryResult = {
  discoveryId: string;
  tileId: string;
  reward: RewardResult;
  creditsSpent: number;
  usedFreeDiscovery: boolean;
  areaCompleted: boolean;
  creditsBalance: string;
  replayed: boolean;
};

export async function discoverTile(userId: string, tileId: string): Promise<DiscoveryResult> {
  const replay = async (): Promise<DiscoveryResult | null> => {
    const [d] = await db
      .select()
      .from(tileDiscoveries)
      .where(and(eq(tileDiscoveries.userId, userId), eq(tileDiscoveries.tileId, tileId)))
      .limit(1);
    if (!d) return null;
    const b = await getBalances(userId);
    return {
      discoveryId: d.id,
      tileId,
      reward: d.reward as RewardResult,
      creditsSpent: d.creditsSpent,
      usedFreeDiscovery: d.usedFreeDiscovery,
      areaCompleted: false,
      creditsBalance: b.CREDITS.toString(),
      replayed: true,
    };
  };
  const prior = await replay();
  if (prior) return prior;

  try {
    return await db.transaction(async (tx) => {
      const profile = await lockPlayer(tx, userId);
      const [tile] = await tx.select().from(mapTiles).where(eq(mapTiles.id, tileId)).limit(1);
      if (!tile || tile.status !== "PUBLISHED") throw new NotFoundError("This tile is not available");
      const [area] = await tx.select().from(mapAreas).where(eq(mapAreas.id, tile.areaId)).limit(1);
      if (!area || area.status !== "PUBLISHED") throw new NotFoundError("This area is not available");
      const [map] = await tx.select().from(maps).where(eq(maps.id, area.mapId)).limit(1);
      if (!(await isAreaAccessible(tx, userId, area.id))) throw new AppError(`${area.name} is locked`, "AREA_LOCKED", 403);

      const poolId = tile.discoveryPoolId ?? area.discoveryPoolId;
      if (!poolId) throw new AppError("Nothing to discover here yet", "NO_POOL");

      const day = await today(tx);
      const cost = tile.costCreditsOverride ?? area.discoveryCostCredits;
      let usedFree = false;
      let spent = 0;
      const discoveryId = crypto.randomUUID();
      let ledgerTxId: string | undefined;
      if (cost > 0) {
        const plan = await getDailyPlan(day, tx);
        const used = await freeDiscoveriesUsed(tx, userId, day);
        if (used < plan.freeDiscoveries) {
          usedFree = true;
        } else {
          await assertWithinSpendLimit(tx, profile, BigInt(cost));
          const posted = await postTransaction(tx, {
            type: "GAME_SPEND",
            userId,
            idempotencyKey: `tile-spend:${userId}:${tile.id}`,
            description: `Map discovery: ${area.name} / ${tile.name}`,
            sourceType: "tile_discovery",
            sourceId: discoveryId,
            entries: [
              { userId, account: "CREDITS", amount: -BigInt(cost) },
              { account: "SYS_GAME_REVENUE", currency: "CREDITS", amount: BigInt(cost) },
            ],
          });
          ledgerTxId = posted.transactionId;
          spent = cost;
        }
      }

      const entry = await pickPoolEntry(tx, poolId);
      const reward = await grantReward(tx, userId, entry, { sourceType: "tile_discovery", sourceId: discoveryId, key: `tile:${userId}:${tile.id}` });
      await tx.insert(tileDiscoveries).values({
        id: discoveryId,
        userId,
        tileId: tile.id,
        areaId: area.id,
        creditsSpent: spent,
        usedFreeDiscovery: usedFree,
        reward,
        poolEntryId: entry.id,
        ledgerTransactionId: ledgerTxId,
        mapVersion: map?.version ?? 1,
        appDay: day,
      });

      await trackMission(tx, userId, "DISCOVER_TILE");
      await checkAchievements(tx, userId, "TILES_DISCOVERED");

      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(mapTiles)
        .where(and(eq(mapTiles.areaId, area.id), eq(mapTiles.status, "PUBLISHED")));
      const [{ found }] = await tx
        .select({ found: sql<number>`count(*)::int` })
        .from(tileDiscoveries)
        .where(and(eq(tileDiscoveries.userId, userId), eq(tileDiscoveries.areaId, area.id)));
      const areaCompleted = found >= total;
      if (areaCompleted) {
        await notify(tx, userId, "REWARD", `${area.icon} ${area.name} fully explored`, "Every tile in this area has been discovered.", "/play/map");
      }
      const b = await getBalances(userId, tx);
      return {
        discoveryId,
        tileId: tile.id,
        reward,
        creditsSpent: spent,
        usedFreeDiscovery: usedFree,
        areaCompleted,
        creditsBalance: b.CREDITS.toString(),
        replayed: false,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const r = await replay();
      if (r) return r;
    }
    throw err;
  }
}

export async function unlockArea(userId: string, areaId: string) {
  try {
    return await db.transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const [area] = await tx.select().from(mapAreas).where(eq(mapAreas.id, areaId)).limit(1);
      if (!area || area.status !== "PUBLISHED") throw new NotFoundError("Area not found");
      if (await isAreaAccessible(tx, userId, area.id)) throw new AppError(`${area.name} is already open`, "ALREADY_UNLOCKED");
      const statuses = await evaluateRequirements(tx, userId, "AREA", area.id);
      if (!statuses.length || !statuses.every((s) => s.met)) {
        throw new AppError("You haven't met all the requirements yet", "REQUIREMENTS_UNMET");
      }
      await tx.insert(areaUnlocks).values({ userId, areaId: area.id, method: "REQUIREMENTS" });
      await consumeRequirements(tx, userId, statuses, { sourceType: "area_unlock", sourceId: area.id });
      const rewards = await grantPool(tx, userId, area.unlockRewardPoolId, {
        sourceType: "area_unlock",
        sourceId: area.id,
        key: `area:${userId}:${area.id}`,
      });
      await trackMission(tx, userId, "UNLOCK_AREA");
      await checkAchievements(tx, userId, "AREAS_UNLOCKED");
      await notify(tx, userId, "REWARD", `${area.icon} ${area.name} unlocked`, area.isSpecial ? "A Special Area has opened on your map." : "A new area has opened on your map.", "/play/map");
      return { area, rewards };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("This area is already unlocked", "ALREADY_UNLOCKED");
    throw err;
  }
}
