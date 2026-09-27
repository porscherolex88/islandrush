import { and, eq, gt, lte, notInArray, sql } from "drizzle-orm";
import type { DbOrTx, Tx } from "@/db";
import {
  achievements,
  areaUnlocks,
  collectionCompletions,
  inventory,
  mysteryBoxPlays,
  profiles,
  tileDiscoveries,
  userAchievements,
  userStreaks,
  vaultUnlocks,
} from "@/db/schema";
import { notify } from "./notifications";
import { grantPool } from "./rewards";

export type AchievementCondition = (typeof achievements.$inferSelect)["condition"];

async function count(tx: DbOrTx, table: typeof mysteryBoxPlays | typeof tileDiscoveries | typeof areaUnlocks | typeof collectionCompletions | typeof vaultUnlocks, userId: string) {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(table.userId, userId));
  return row?.n ?? 0;
}

export async function metricFor(tx: DbOrTx, userId: string, condition: AchievementCondition): Promise<number> {
  switch (condition) {
    case "BOXES_OPENED":
      return count(tx, mysteryBoxPlays, userId);
    case "TILES_DISCOVERED":
      return count(tx, tileDiscoveries, userId);
    case "AREAS_UNLOCKED":
      return count(tx, areaUnlocks, userId);
    case "COLLECTIONS_COMPLETED":
      return count(tx, collectionCompletions, userId);
    case "VAULTS_UNLOCKED":
      return count(tx, vaultUnlocks, userId);
    case "STREAK_DAYS": {
      const [s] = await tx.select().from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1);
      return s?.longest ?? 0;
    }
    case "XP_LEVEL": {
      const [p] = await tx.select({ l: profiles.xpLevel }).from(profiles).where(eq(profiles.id, userId)).limit(1);
      return p?.l ?? 1;
    }
    case "ITEMS_COLLECTED": {
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(inventory)
        .where(and(eq(inventory.userId, userId), gt(inventory.totalAcquired, 0)));
      return row?.n ?? 0;
    }
  }
}

/** Awards any newly-earned achievements for a condition. Idempotent via a unique (user, achievement) constraint. */
export async function checkAchievements(tx: Tx, userId: string, condition: AchievementCondition) {
  const value = await metricFor(tx, userId, condition);
  const earned = tx.select({ id: userAchievements.achievementId }).from(userAchievements).where(eq(userAchievements.userId, userId));
  const candidates = await tx
    .select()
    .from(achievements)
    .where(
      and(
        eq(achievements.condition, condition),
        eq(achievements.active, true),
        lte(achievements.threshold, value),
        notInArray(achievements.id, earned),
      ),
    );
  for (const ach of candidates) {
    const inserted = await tx
      .insert(userAchievements)
      .values({ userId, achievementId: ach.id })
      .onConflictDoNothing()
      .returning({ id: userAchievements.id });
    if (inserted.length === 0) continue;
    const rewards = await grantPool(tx, userId, ach.rewardPoolId, {
      sourceType: "achievement",
      sourceId: ach.id,
      key: `achievement:${userId}:${ach.id}`,
    });
    await notify(
      tx,
      userId,
      "REWARD",
      `${ach.badgeIcon} Achievement unlocked: ${ach.name}`,
      rewards.length ? `You earned the ${ach.badgeName} badge and ${rewards.map((r) => r.display).join(", ")}.` : `You earned the ${ach.badgeName} badge.`,
      "/app/progress",
    );
  }
}
