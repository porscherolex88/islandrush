import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, mysteryBoxes, mysteryBoxPlays, rewardPoolEntries } from "@/db/schema";
import { AppError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { checkAchievements } from "./achievements";
import { getConfig } from "./config";
import { today, trackMission } from "./daily";
import { boxLockReason, recordEvent } from "./adventure-core";
import { assertWithinSpendLimit, lockPlayer } from "./guards";
import { getBalances, postTransaction } from "./ledger";
import { grantPool, grantReward, pickPoolEntry, type RewardResult } from "./rewards";

export type BoxPlayResult = {
  playId: string;
  boxId: string;
  level: number | null;
  selectedIndex: number;
  creditsSpent: number;
  reward: RewardResult;
  loot: RewardResult[];
  creditsBalance: string;
  replayed: boolean;
};

async function existingPlay(userId: string, idempotencyKey: string): Promise<BoxPlayResult | null> {
  const [play] = await db
    .select()
    .from(mysteryBoxPlays)
    .where(and(eq(mysteryBoxPlays.userId, userId), eq(mysteryBoxPlays.idempotencyKey, idempotencyKey)))
    .limit(1);
  if (!play) return null;
  const balances = await getBalances(userId);
  return {
    playId: play.id,
    boxId: play.boxId,
    level: play.level,
    selectedIndex: play.selectedIndex,
    creditsSpent: play.creditsSpent,
    reward: play.reward as RewardResult,
    loot: play.loot as RewardResult[],
    creditsBalance: balances.CREDITS.toString(),
    replayed: true,
  };
}

/**
 * Opens a Mystery Box. The client only chooses which of the nine boxes to open;
 * the reward is determined here on the server after Credits are atomically deducted.
 */
export async function playMysteryBox(
  userId: string,
  input: { boxId: string; selectedIndex: number; idempotencyKey: string },
): Promise<BoxPlayResult> {
  if (!Number.isInteger(input.selectedIndex) || input.selectedIndex < 0 || input.selectedIndex > 8) {
    throw new AppError("Choose one of the nine boxes", "INVALID_SELECTION");
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 100) throw new AppError("Invalid request", "INVALID_KEY");

  const prior = await existingPlay(userId, input.idempotencyKey);
  if (prior) return prior;

  try {
    return await db.transaction(async (tx) => {
      const profile = await lockPlayer(tx, userId);
      const [box] = await tx.select().from(mysteryBoxes).where(eq(mysteryBoxes.id, input.boxId)).limit(1);
      if (!box || box.status !== "PUBLISHED") throw new NotFoundError("This Mystery Box is not available");
      const locked = await boxLockReason(tx, userId, box);
      if (locked) throw new AppError(locked, "BOX_LOCKED", 403);

      const day = await today(tx);
      const limits = await getConfig("limits", tx);
      const [{ todayCount }] = await tx
        .select({ todayCount: sql<number>`count(*)::int` })
        .from(mysteryBoxPlays)
        .where(and(eq(mysteryBoxPlays.userId, userId), eq(mysteryBoxPlays.appDay, day)));
      if (limits.maxBoxOpensPerDay && todayCount >= limits.maxBoxOpensPerDay) {
        throw new AppError("You've reached today's Mystery Box limit", "DAILY_LIMIT");
      }
      if (box.dailyLimitPerUser) {
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(mysteryBoxPlays)
          .where(and(eq(mysteryBoxPlays.userId, userId), eq(mysteryBoxPlays.boxId, box.id), eq(mysteryBoxPlays.appDay, day)));
        if (n >= box.dailyLimitPerUser) throw new AppError(`You can open ${box.name} ${box.dailyLimitPerUser} times per day`, "BOX_DAILY_LIMIT");
      }
      if (box.totalLimit) {
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(mysteryBoxPlays)
          .where(eq(mysteryBoxPlays.boxId, box.id));
        if (n >= box.totalLimit) throw new AppError("This Mystery Box has sold out", "BOX_SOLD_OUT");
      }

      const price = BigInt(box.priceCredits);
      await assertWithinSpendLimit(tx, profile, price);

      const playId = randomUUID();
      const spend = await postTransaction(tx, {
        type: "GAME_SPEND",
        userId,
        idempotencyKey: `box-spend:${userId}:${input.idempotencyKey}`,
        description: `Mystery Box: ${box.name}`,
        sourceType: "mystery_box_play",
        sourceId: playId,
        metadata: { boxId: box.id, selectedIndex: input.selectedIndex },
        entries: [
          { userId, account: "CREDITS", amount: -price },
          { account: "SYS_GAME_REVENUE", currency: "CREDITS", amount: price },
        ],
      });

      const loot = await grantPool(tx, userId, box.lootPoolId, {
        sourceType: "mystery_box_play",
        sourceId: playId,
        key: `box:${userId}:${input.idempotencyKey}:loot`,
      });
      const entry = await pickPoolEntry(tx, box.rewardPoolId);
      const reward = await grantReward(tx, userId, entry, {
        sourceType: "mystery_box_play",
        sourceId: playId,
        key: `box:${userId}:${input.idempotencyKey}`,
        level: box.level,
      });
      const configSnapshot = {
        priceCredits: box.priceCredits,
        rewardPoolId: box.rewardPoolId,
        lootPoolId: box.lootPoolId,
        requiresMapLevel: box.requiresMapLevel,
        boxUpdatedAt: box.updatedAt.toISOString(),
      };

      await tx.insert(mysteryBoxPlays).values({
        id: playId,
        userId,
        boxId: box.id,
        selectedIndex: input.selectedIndex,
        creditsSpent: box.priceCredits,
        poolEntryId: entry.id,
        reward,
        loot,
        level: box.level,
        configSnapshot,
        idempotencyKey: input.idempotencyKey,
        ledgerTransactionId: spend.transactionId,
        appDay: day,
      });

      if (box.level !== null) {
        const base = { userId, level: box.level, refType: "mystery_box_play", refId: playId, config: configSnapshot };
        await recordEvent(tx, { ...base, type: "MYSTERY_BOX_PURCHASE", actionId: playId, result: { creditsSpent: box.priceCredits }, ledgerTransactionId: spend.transactionId });
        await recordEvent(tx, { ...base, type: "MYSTERY_BOX_REWARD", actionId: playId, result: { reward } });
        if (loot.length) await recordEvent(tx, { ...base, type: "LOOT_REWARD", actionId: playId, result: { loot } });
      }

      await trackMission(tx, userId, "OPEN_BOX");
      await checkAchievements(tx, userId, "BOXES_OPENED");

      const balances = await getBalances(userId, tx);
      return {
        playId,
        boxId: box.id,
        level: box.level,
        selectedIndex: input.selectedIndex,
        creditsSpent: box.priceCredits,
        reward,
        loot,
        creditsBalance: balances.CREDITS.toString(),
        replayed: false,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const replay = await existingPlay(userId, input.idempotencyKey);
      if (replay) return replay;
    }
    throw err;
  }
}

export async function listBoxes() {
  return db.select().from(mysteryBoxes).where(eq(mysteryBoxes.status, "PUBLISHED")).orderBy(mysteryBoxes.sortOrder);
}

/** Published odds for transparency: each entry's share of the total active weight. */
export async function boxOdds(poolId: string) {
  const rows = await db
    .select({ e: rewardPoolEntries, itemIcon: items.icon, itemRarity: items.rarity })
    .from(rewardPoolEntries)
    .leftJoin(items, eq(items.id, rewardPoolEntries.itemId))
    .where(and(eq(rewardPoolEntries.poolId, poolId), eq(rewardPoolEntries.active, true)))
    .orderBy(rewardPoolEntries.sortOrder);
  const available = rows.filter(({ e }) => e.weight > 0 && (e.maxAwards === null || e.awardedCount < e.maxAwards));
  const total = available.reduce((s, { e }) => s + e.weight, 0) || 1;
  return available.map(({ e, itemIcon, itemRarity }) => ({
    id: e.id,
    label: e.label,
    rarity: itemRarity ?? e.rarity,
    type: e.rewardType,
    amount: e.amount,
    icon: itemIcon ?? e.reveal?.icon ?? TYPE_ICON[e.rewardType],
    pct: (e.weight / total) * 100,
  }));
}

export const poolOdds = boxOdds;
export type PoolOdds = Awaited<ReturnType<typeof boxOdds>>;

const TYPE_ICON: Record<string, string> = { CREDITS: "🪙", CASH: "💵", ITEM: "🎁", AREA_UNLOCK: "🗺️", FREE_UNLOCK: "🔓" };

export async function playHistory(userId: string, limit = 30, offset = 0) {
  return db
    .select({
      id: mysteryBoxPlays.id,
      createdAt: mysteryBoxPlays.createdAt,
      creditsSpent: mysteryBoxPlays.creditsSpent,
      reward: mysteryBoxPlays.reward,
      loot: mysteryBoxPlays.loot,
      level: mysteryBoxPlays.level,
      selectedIndex: mysteryBoxPlays.selectedIndex,
      boxName: mysteryBoxes.name,
    })
    .from(mysteryBoxPlays)
    .innerJoin(mysteryBoxes, eq(mysteryBoxes.id, mysteryBoxPlays.boxId))
    .where(eq(mysteryBoxPlays.userId, userId))
    .orderBy(desc(mysteryBoxPlays.createdAt))
    .limit(limit)
    .offset(offset);
}
