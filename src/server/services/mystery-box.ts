import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, max, sql } from "drizzle-orm";
import { db, type DbOrTx, type Tx } from "@/db";
import { boxJackpots, freeBoxPlays, items, mysteryBoxes, mysteryBoxPlays, rewardPoolEntries } from "@/db/schema";
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
  /** This play used a free play won from a Free unlock. */
  freePlay: boolean;
  /** Free plays still waiting on this box. */
  freePlaysLeft: number;
  reward: RewardResult;
  loot: RewardResult[];
  creditsBalance: string;
  /** Set when this play filled the jackpot meter: every free spin it gave, in order. */
  jackpot: JackpotResult | null;
  /** The jackpot meter after this play, or null when the box has no jackpot. */
  meter: JackpotMeter | null;
  replayed: boolean;
};

export type JackpotMeter = { plays: number; target: number; spins: number };
export type JackpotSpin = { reward: RewardResult; loot: RewardResult[] };
export type JackpotResult = { id: string; spins: JackpotSpin[] };

type Box = typeof mysteryBoxes.$inferSelect;

/** How full a player's jackpot meter is on a box. Jackpot spins never count toward it. */
export async function jackpotMeter(userId: string, box: Pick<Box, "id" | "jackpotPlays" | "jackpotSpins">, tx: DbOrTx = db) {
  if (box.jackpotPlays <= 0) return { meter: null, total: 0 };
  const [[played], [last]] = await Promise.all([
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(mysteryBoxPlays)
      .where(and(eq(mysteryBoxPlays.userId, userId), eq(mysteryBoxPlays.boxId, box.id), isNull(mysteryBoxPlays.jackpotId))),
    tx
      .select({ at: max(boxJackpots.playsAt) })
      .from(boxJackpots)
      .where(and(eq(boxJackpots.userId, userId), eq(boxJackpots.boxId, box.id))),
  ]);
  const total = Number(played?.n ?? 0);
  const plays = Math.max(0, Math.min(box.jackpotPlays, total - Number(last?.at ?? 0)));
  return { meter: { plays, target: box.jackpotPlays, spins: box.jackpotSpins } as JackpotMeter, total };
}

async function jackpotFor(playId: string): Promise<JackpotResult | null> {
  const [jp] = await db.select({ id: boxJackpots.id }).from(boxJackpots).where(eq(boxJackpots.triggerPlayId, playId)).limit(1);
  if (!jp) return null;
  const spins = await db
    .select({ reward: mysteryBoxPlays.reward, loot: mysteryBoxPlays.loot })
    .from(mysteryBoxPlays)
    .where(eq(mysteryBoxPlays.jackpotId, jp.id))
    .orderBy(asc(mysteryBoxPlays.jackpotSpin));
  return { id: jp.id, spins: spins.map((x) => ({ reward: x.reward as RewardResult, loot: x.loot as RewardResult[] })) };
}

/** Free plays the player has won on a box and not used yet. */
export async function freePlaysLeft(userId: string, boxId: string, tx: DbOrTx = db) {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(freeBoxPlays)
    .where(and(eq(freeBoxPlays.userId, userId), eq(freeBoxPlays.boxId, boxId), isNull(freeBoxPlays.usedByPlayId)));
  return Number(row?.n ?? 0);
}

async function existingPlay(userId: string, idempotencyKey: string): Promise<BoxPlayResult | null> {
  const [play] = await db
    .select()
    .from(mysteryBoxPlays)
    .where(and(eq(mysteryBoxPlays.userId, userId), eq(mysteryBoxPlays.idempotencyKey, idempotencyKey)))
    .limit(1);
  if (!play) return null;
  const [balances, left, [used], jackpot, [box]] = await Promise.all([
    getBalances(userId),
    freePlaysLeft(userId, play.boxId),
    db.select({ id: freeBoxPlays.id }).from(freeBoxPlays).where(eq(freeBoxPlays.usedByPlayId, play.id)).limit(1),
    jackpotFor(play.id),
    db.select().from(mysteryBoxes).where(eq(mysteryBoxes.id, play.boxId)).limit(1),
  ]);
  return {
    playId: play.id,
    boxId: play.boxId,
    level: play.level,
    selectedIndex: play.selectedIndex,
    creditsSpent: play.creditsSpent,
    freePlay: Boolean(used),
    freePlaysLeft: left,
    reward: play.reward as RewardResult,
    loot: play.loot as RewardResult[],
    creditsBalance: balances.CREDITS.toString(),
    jackpot,
    meter: box ? (await jackpotMeter(userId, box)).meter : null,
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
        .where(and(eq(mysteryBoxPlays.userId, userId), eq(mysteryBoxPlays.appDay, day), isNull(mysteryBoxPlays.jackpotId)));
      if (limits.maxBoxOpensPerDay && todayCount >= limits.maxBoxOpensPerDay) {
        throw new AppError("You've reached today's Mystery Box limit", "DAILY_LIMIT");
      }
      if (box.dailyLimitPerUser) {
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(mysteryBoxPlays)
          .where(and(eq(mysteryBoxPlays.userId, userId), eq(mysteryBoxPlays.boxId, box.id), eq(mysteryBoxPlays.appDay, day), isNull(mysteryBoxPlays.jackpotId)));
        if (n >= box.dailyLimitPerUser) throw new AppError(`You can open ${box.name} ${box.dailyLimitPerUser} times per day`, "BOX_DAILY_LIMIT");
      }
      if (box.totalLimit) {
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(mysteryBoxPlays)
          .where(and(eq(mysteryBoxPlays.boxId, box.id), isNull(mysteryBoxPlays.jackpotId)));
        if (n >= box.totalLimit) throw new AppError("This Mystery Box has sold out", "BOX_SOLD_OUT");
      }

      const playId = randomUUID();
      const [free] = await tx
        .select({ id: freeBoxPlays.id })
        .from(freeBoxPlays)
        .where(and(eq(freeBoxPlays.userId, userId), eq(freeBoxPlays.boxId, box.id), isNull(freeBoxPlays.usedByPlayId)))
        .orderBy(asc(freeBoxPlays.createdAt))
        .limit(1);
      if (free) await tx.update(freeBoxPlays).set({ usedByPlayId: playId, usedAt: new Date() }).where(eq(freeBoxPlays.id, free.id));
      const creditsSpent = free ? 0 : box.priceCredits;
      const price = BigInt(creditsSpent);
      if (!free) await assertWithinSpendLimit(tx, profile, price);

      const spend = free
        ? null
        : await postTransaction(tx, {
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
        boxId: box.id,
      });
      const configSnapshot = {
        priceCredits: box.priceCredits,
        freePlayId: free?.id ?? null,
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
        creditsSpent,
        poolEntryId: entry.id,
        reward,
        loot,
        level: box.level,
        configSnapshot,
        idempotencyKey: input.idempotencyKey,
        ledgerTransactionId: spend?.transactionId ?? null,
        appDay: day,
      });

      if (box.level !== null) {
        const base = { userId, level: box.level, refType: "mystery_box_play", refId: playId, config: configSnapshot };
        await recordEvent(tx, { ...base, type: "MYSTERY_BOX_PURCHASE", actionId: playId, result: { creditsSpent, freePlay: Boolean(free) }, ledgerTransactionId: spend?.transactionId ?? null });
        await recordEvent(tx, { ...base, type: "MYSTERY_BOX_REWARD", actionId: playId, result: { reward } });
        if (loot.length) await recordEvent(tx, { ...base, type: "LOOT_REWARD", actionId: playId, result: { loot } });
      }

      const filled = await jackpotMeter(userId, box, tx);
      let meter = filled.meter;
      let jackpot: JackpotResult | null = null;
      if (meter && meter.plays >= meter.target) {
        jackpot = await runJackpot(tx, userId, box, { triggerPlayId: playId, playsAt: filled.total, day, configSnapshot });
        meter = { ...meter, plays: 0 };
      }

      await trackMission(tx, userId, "OPEN_BOX");
      await checkAchievements(tx, userId, "BOXES_OPENED");

      const balances = await getBalances(userId, tx);
      return {
        playId,
        boxId: box.id,
        level: box.level,
        selectedIndex: input.selectedIndex,
        creditsSpent,
        freePlay: Boolean(free),
        freePlaysLeft: await freePlaysLeft(userId, box.id, tx),
        reward,
        loot,
        creditsBalance: balances.CREDITS.toString(),
        jackpot,
        meter,
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

/** Spins the box for free `box.jackpotSpins` times. Each spin grants Loot and a lucky drop like a normal play. */
async function runJackpot(
  tx: Tx,
  userId: string,
  box: Box,
  at: { triggerPlayId: string; playsAt: number; day: string; configSnapshot: Record<string, unknown> },
): Promise<JackpotResult> {
  const id = randomUUID();
  await tx.insert(boxJackpots).values({ id, userId, boxId: box.id, triggerPlayId: at.triggerPlayId, playsAt: at.playsAt, spins: box.jackpotSpins });
  const spins: JackpotSpin[] = [];
  for (let i = 0; i < box.jackpotSpins; i++) {
    const spinId = randomUUID();
    const ctx = { sourceType: "mystery_box_play", sourceId: spinId, key: `jackpot:${id}:${i}` };
    const loot = await grantPool(tx, userId, box.lootPoolId, { ...ctx, key: `${ctx.key}:loot` });
    const entry = await pickPoolEntry(tx, box.rewardPoolId);
    const reward = await grantReward(tx, userId, entry, { ...ctx, level: box.level, boxId: box.id });
    const configSnapshot = { ...at.configSnapshot, jackpotId: id };
    await tx.insert(mysteryBoxPlays).values({
      id: spinId,
      userId,
      boxId: box.id,
      selectedIndex: 0,
      creditsSpent: 0,
      poolEntryId: entry.id,
      reward,
      loot,
      level: box.level,
      configSnapshot,
      idempotencyKey: `jackpot:${id}:${i}`,
      appDay: at.day,
      jackpotId: id,
      jackpotSpin: i,
    });
    if (box.level !== null) {
      await recordEvent(tx, { userId, level: box.level, refType: "mystery_box_play", refId: spinId, config: configSnapshot, type: "MYSTERY_BOX_REWARD", actionId: spinId, result: { reward, loot, jackpotId: id } });
    }
    spins.push({ reward, loot });
  }
  return { id, spins };
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

export type PoolOdds = Awaited<ReturnType<typeof boxOdds>>;

/** What a pool can give, for players. Chances stay on the server and in admin only. */
export async function boxPrizes(poolId: string) {
  return (await boxOdds(poolId)).map(({ id, label, rarity, type, amount, icon }) => ({ id, label, rarity, type, amount, icon }));
}
export type PrizeList = Awaited<ReturnType<typeof boxPrizes>>;

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
      jackpot: sql<boolean>`${mysteryBoxPlays.jackpotId} is not null`,
    })
    .from(mysteryBoxPlays)
    .innerJoin(mysteryBoxes, eq(mysteryBoxes.id, mysteryBoxPlays.boxId))
    .where(eq(mysteryBoxPlays.userId, userId))
    .orderBy(desc(mysteryBoxPlays.createdAt))
    .limit(limit)
    .offset(offset);
}
