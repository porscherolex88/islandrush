import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { areaUnlocks, cashRewards, items, mapAreas, profiles, rewardPoolEntries, rewardPools } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { formatCredits, toMinor } from "@/lib/money";
import { fmtCash } from "@/lib/format-money";
import { weightedPick } from "@/lib/rng";
import { currentAdventureLevel, freeUnlockFill } from "./adventure-core";
import { getConfig } from "./config";
import { grantItem } from "./inventory";
import { postTransaction, type RewardSource } from "./ledger";

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type RewardType = "CREDITS" | "CASH" | "ITEM" | "AREA_UNLOCK" | "FREE_UNLOCK";

export type RewardResult = {
  entryId: string | null;
  type: RewardType;
  label: string;
  amount: string;
  display: string;
  icon: string;
  rarity: Rarity;
  itemId?: string;
  itemName?: string;
  areaId?: string;
  color?: string;
  headline?: string;
};

export type PoolEntry = typeof rewardPoolEntries.$inferSelect;

export type GrantContext = {
  sourceType: string;
  sourceId: string;
  /** Unique, deterministic key for this grant; used for ledger idempotency. */
  key: string;
  rewardSource?: RewardSource;
  /** Adventure level a Free unlock applies to. Defaults to the player's current level. */
  level?: number | null;
};

const RARITY_ICON: Record<RewardType, string> = {
  CREDITS: "🪙",
  CASH: "💵",
  ITEM: "🎁",
  AREA_UNLOCK: "🗺️",
  FREE_UNLOCK: "🔓",
};

/** Picks one entry from a weighted pool, honouring per-entry availability limits atomically. */
export async function pickPoolEntry(tx: Tx, poolId: string): Promise<PoolEntry> {
  const [pool] = await tx.select().from(rewardPools).where(eq(rewardPools.id, poolId)).limit(1);
  if (!pool || pool.status !== "PUBLISHED") throw new AppError("This reward pool is not available", "POOL_UNAVAILABLE");
  let candidates = await tx
    .select()
    .from(rewardPoolEntries)
    .where(
      and(
        eq(rewardPoolEntries.poolId, poolId),
        eq(rewardPoolEntries.active, true),
        or(isNull(rewardPoolEntries.maxAwards), lt(rewardPoolEntries.awardedCount, rewardPoolEntries.maxAwards)),
      ),
    );
  for (let attempt = 0; attempt < 6; attempt++) {
    const pick = weightedPick(candidates);
    if (!pick) break;
    if (pick.maxAwards === null) return pick;
    const [claimed] = await tx
      .update(rewardPoolEntries)
      .set({ awardedCount: sql`${rewardPoolEntries.awardedCount} + 1` })
      .where(and(eq(rewardPoolEntries.id, pick.id), lt(rewardPoolEntries.awardedCount, pick.maxAwards)))
      .returning();
    if (claimed) return claimed;
    candidates = candidates.filter((c) => c.id !== pick.id);
  }
  throw new AppError("Rewards are temporarily unavailable. Please try again later.", "POOL_EXHAUSTED");
}

export async function describeEntry(tx: Tx, entry: PoolEntry): Promise<RewardResult> {
  const base = {
    entryId: entry.id,
    type: entry.rewardType,
    label: entry.label,
    amount: entry.amount,
    rarity: entry.rarity,
    color: entry.reveal?.color,
    headline: entry.reveal?.headline,
  };
  switch (entry.rewardType) {
    case "CREDITS":
      return { ...base, display: `${formatCredits(entry.amount)} Credits`, icon: entry.reveal?.icon ?? RARITY_ICON.CREDITS };
    case "CASH":
      return { ...base, display: await fmtCash(entry.amount), icon: entry.reveal?.icon ?? RARITY_ICON.CASH };
    case "ITEM": {
      const [item] = entry.itemId ? await tx.select().from(items).where(eq(items.id, entry.itemId)).limit(1) : [];
      const qty = Number(toMinor(entry.amount || "1", "CREDITS")) || 1;
      return {
        ...base,
        rarity: item?.rarity ?? entry.rarity,
        itemId: entry.itemId ?? undefined,
        itemName: item?.name,
        display: `${qty > 1 ? `${qty}× ` : ""}${item?.name ?? entry.label}`,
        icon: item?.icon ?? entry.reveal?.icon ?? RARITY_ICON.ITEM,
      };
    }
    case "AREA_UNLOCK": {
      const [area] = entry.areaId ? await tx.select().from(mapAreas).where(eq(mapAreas.id, entry.areaId)).limit(1) : [];
      return {
        ...base,
        areaId: entry.areaId ?? undefined,
        display: `Map access: ${area?.name ?? entry.label}`,
        icon: area?.icon ?? RARITY_ICON.AREA_UNLOCK,
      };
    }
    case "FREE_UNLOCK":
      return { ...base, display: "Free unlock: your next chest, filled", icon: entry.reveal?.icon ?? RARITY_ICON.FREE_UNLOCK };
  }
}

async function grantCredits(tx: Tx, userId: string, amount: string, label: string, ctx: GrantContext) {
  const n = toMinor(amount, "CREDITS");
  if (n <= 0n) return;
  await postTransaction(tx, {
    type: "GAME_REWARD_CREDITS",
    userId,
    idempotencyKey: `${ctx.key}:credits`,
    description: `${label} (${ctx.sourceType})`,
    sourceType: ctx.sourceType,
    sourceId: ctx.sourceId,
    rewardSource: "GAME_REWARD",
    entries: [
      { account: "SYS_REWARD_EXPENSE", currency: "CREDITS", amount: -n },
      { userId, account: "CREDITS", amount: n },
    ],
  });
}

/**
 * Fills the player's next chest on the level with primary Loot. When nothing is left to unlock,
 * the entry's amount is paid as Credits instead so the win is never wasted.
 */
async function grantFreeUnlock(tx: Tx, userId: string, entry: PoolEntry, result: RewardResult, ctx: GrantContext): Promise<RewardResult> {
  const level = ctx.level ?? (await currentAdventureLevel(tx, userId));
  const fill = level ? await freeUnlockFill(tx, userId, level) : null;
  if (!fill) {
    await grantCredits(tx, userId, entry.amount, entry.label, ctx);
    return { ...result, amount: entry.amount, display: `Free unlock: ${formatCredits(entry.amount)} Credits instead`, headline: "Nothing left to unlock here, so it paid out in Credits" };
  }
  await grantItem(tx, userId, fill.item.id, fill.need, { sourceType: ctx.sourceType, sourceId: ctx.sourceId, reason: entry.label });
  return {
    ...result,
    amount: String(fill.need),
    itemId: fill.item.id,
    itemName: fill.item.name,
    display: `Free unlock: next ${fill.mapName} chest filled`,
    headline: `+${fill.need} ${fill.item.name} added for free`,
  };
}

/** Applies a reward to the user. Every effect is recorded (ledger, inventory events). */
export async function grantReward(tx: Tx, userId: string, entry: PoolEntry, ctx: GrantContext): Promise<RewardResult> {
  const result = await describeEntry(tx, entry);
  switch (entry.rewardType) {
    case "CREDITS":
      await grantCredits(tx, userId, entry.amount, entry.label, ctx);
      break;
    case "CASH":
      await createCashReward(tx, {
        userId,
        amount: entry.amount,
        source: ctx.rewardSource ?? "GAME_REWARD",
        sourceType: ctx.sourceType,
        sourceId: ctx.sourceId,
        key: ctx.key,
        description: entry.label,
      });
      break;
    case "ITEM": {
      if (!entry.itemId) throw new AppError("Reward item missing", "REWARD_INVALID", 500);
      const qty = Number(toMinor(entry.amount || "1", "CREDITS")) || 1;
      await grantItem(tx, userId, entry.itemId, qty, { sourceType: ctx.sourceType, sourceId: ctx.sourceId, reason: entry.label });
      break;
    }
    case "AREA_UNLOCK":
      if (entry.areaId) {
        await tx.insert(areaUnlocks).values({ userId, areaId: entry.areaId, method: "REWARD" }).onConflictDoNothing();
      }
      break;
    case "FREE_UNLOCK":
      return grantFreeUnlock(tx, userId, entry, result, ctx);
  }
  return result;
}

/** Grants a pool: WEIGHTED pools grant one random entry, ALL pools grant every active entry. */
export async function grantPool(tx: Tx, userId: string, poolId: string | null | undefined, ctx: GrantContext): Promise<RewardResult[]> {
  if (!poolId) return [];
  const [pool] = await tx.select().from(rewardPools).where(eq(rewardPools.id, poolId)).limit(1);
  if (!pool || pool.status !== "PUBLISHED") return [];
  if (pool.mode === "WEIGHTED") {
    const entry = await pickPoolEntry(tx, poolId);
    return [await grantReward(tx, userId, entry, ctx)];
  }
  const entries = await tx
    .select()
    .from(rewardPoolEntries)
    .where(and(eq(rewardPoolEntries.poolId, poolId), eq(rewardPoolEntries.active, true)))
    .orderBy(rewardPoolEntries.sortOrder);
  const results: RewardResult[] = [];
  for (const [i, entry] of entries.entries()) {
    results.push(await grantReward(tx, userId, entry, { ...ctx, key: `${ctx.key}:${i}` }));
  }
  return results;
}

export async function createCashReward(
  tx: Tx,
  input: {
    userId: string;
    amount: string;
    source: RewardSource;
    sourceType: string;
    sourceId: string;
    key: string;
    description: string;
    refereeId?: string;
    referralLevel?: number;
    depositId?: string;
    pendingHours?: number;
  },
) {
  const minor = toMinor(input.amount, "MYR");
  if (minor <= 0n) return null;
  const [profile] = await tx
    .select({ rewardsOnHold: profiles.rewardsOnHold })
    .from(profiles)
    .where(eq(profiles.id, input.userId))
    .limit(1);
  const hours = input.pendingHours ?? (await getConfig("rewards", tx)).pendingHours;
  const isReferral = input.source.startsWith("REFERRAL");
  const posted = await postTransaction(tx, {
    type: isReferral ? "REFERRAL_REWARD" : "CASH_REWARD",
    userId: input.userId,
    idempotencyKey: `${input.key}:cash`,
    description: input.description,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    rewardSource: input.source,
    entries: [
      {
        account: isReferral ? "SYS_REFERRAL_EXPENSE" : "SYS_REWARD_EXPENSE",
        currency: "MYR",
        amount: -minor,
      },
      { userId: input.userId, account: "PENDING_REWARDS", amount: minor },
    ],
  });
  if (posted.replayed) return null;
  const [row] = await tx
    .insert(cashRewards)
    .values({
      userId: input.userId,
      amount: input.amount,
      source: input.source,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: profile?.rewardsOnHold ? "HELD" : "PENDING",
      heldReason: profile?.rewardsOnHold ? "Account rewards are on hold pending review" : null,
      refereeId: input.refereeId,
      referralLevel: input.referralLevel,
      depositId: input.depositId,
      settleAfter: new Date(Date.now() + hours * 3_600_000),
      creditTransactionId: posted.transactionId,
    })
    .returning();
  return row;
}
