import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { cashRewards, deposits, profiles, referralLevels } from "@/db/schema";
import { toDecimal, toMinor } from "@/lib/money";
import { getConfig } from "./config";
import { notify } from "./notifications";
import { createCashReward } from "./rewards";
import { flagRisk, linkedRisk } from "./risk";

const SOURCE_BY_LEVEL = { 1: "REFERRAL_L1", 2: "REFERRAL_L2", 3: "REFERRAL_L3" } as const;

/** Creates multi-level referral rewards when a referee's first qualifying deposit is approved. */
export async function processReferralRewards(tx: Tx, deposit: typeof deposits.$inferSelect) {
  const cfg = await getConfig("referral", tx);
  if (!cfg.enabled) return [];
  const amount = toMinor(deposit.amount);
  const minimum = toMinor(cfg.qualifyingDepositMin);
  if (amount < minimum) return [];

  const [{ prior }] = await tx
    .select({ prior: sql<number>`count(*)::int` })
    .from(deposits)
    .where(
      and(
        eq(deposits.userId, deposit.userId),
        eq(deposits.status, "APPROVED"),
        ne(deposits.id, deposit.id),
        gte(deposits.amount, cfg.qualifyingDepositMin),
      ),
    );
  if (prior > 0) return [];

  const levels = await tx.select().from(referralLevels).where(eq(referralLevels.active, true)).orderBy(asc(referralLevels.level));
  const maxLevel = Math.min(3, cfg.levels);
  const created: (typeof cashRewards.$inferSelect)[] = [];
  const [referee] = await tx.select().from(profiles).where(eq(profiles.id, deposit.userId)).limit(1);
  let currentId = referee?.referredById ?? null;
  const visited = new Set<string>([deposit.userId]);

  for (let level = 1; level <= maxLevel && currentId; level++) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const [referrer] = await tx.select().from(profiles).where(eq(profiles.id, currentId)).limit(1);
    if (!referrer) break;
    const rule = levels.find((l) => l.level === level);
    if (rule && referrer.status === "ACTIVE") {
      const reward = rule.rewardKind === "PERCENT" ? (amount * toMinor(rule.value)) / 10000n : toMinor(rule.value);
      if (reward > 0n) {
        const row = await createCashReward(tx, {
          userId: referrer.id,
          amount: toDecimal(reward),
          source: SOURCE_BY_LEVEL[level as 1 | 2 | 3],
          sourceType: "referral",
          sourceId: deposit.id,
          key: `referral:${deposit.id}:${level}`,
          description: `Level ${level} referral reward`,
          refereeId: deposit.userId,
          referralLevel: level,
          depositId: deposit.id,
          pendingHours: cfg.pendingHours,
        });
        if (row) {
          if (row.status === "PENDING" && (await linkedRisk(tx, referrer.id, deposit.userId))) {
            await tx
              .update(cashRewards)
              .set({ status: "HELD", heldReason: "Held for routine review", updatedAt: new Date() })
              .where(eq(cashRewards.id, row.id));
            row.status = "HELD";
          }
          created.push(row);
          await notify(
            tx,
            referrer.id,
            "REFERRAL",
            "Referral reward earned",
            `RM${toDecimal(reward)} from a level ${level} referral is pending and will become withdrawable once eligible.`,
            "/invite",
          );
        }
      }
    }
    currentId = referrer.referredById;
  }

  if (referee?.referredById && created.length) {
    const since = new Date(Date.now() - 86_400_000);
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(cashRewards)
      .where(and(eq(cashRewards.userId, referee.referredById), eq(cashRewards.referralLevel, 1), gte(cashRewards.createdAt, since)));
    if (n > cfg.velocityThresholdPerDay) {
      await flagRisk(tx, {
        userId: referee.referredById,
        type: "REFERRAL_VELOCITY",
        severity: "MEDIUM",
        summary: `${n} qualifying referral deposits in 24 hours`,
      });
    }
  }
  return created;
}

export async function getReferralSummary(userId: string) {
  const [me] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  const l1 = await db
    .select({ id: profiles.id, name: profiles.name, createdAt: profiles.createdAt, totalDeposits: profiles.totalDeposits })
    .from(profiles)
    .where(eq(profiles.referredById, userId))
    .orderBy(desc(profiles.createdAt));
  const l1Ids = l1.map((r) => r.id);
  const l2 = l1Ids.length ? await db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.referredById, l1Ids)) : [];
  const l2Ids = l2.map((r) => r.id);
  const l3 = l2Ids.length ? await db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.referredById, l2Ids)) : [];
  const rewards = await db
    .select({ status: cashRewards.status, level: cashRewards.referralLevel, total: sql<string>`coalesce(sum(${cashRewards.amount}),0)` })
    .from(cashRewards)
    .where(and(eq(cashRewards.userId, userId), sql`${cashRewards.referralLevel} is not null`))
    .groupBy(cashRewards.status, cashRewards.referralLevel);
  const recentRewards = await db
    .select()
    .from(cashRewards)
    .where(and(eq(cashRewards.userId, userId), sql`${cashRewards.referralLevel} is not null`))
    .orderBy(desc(cashRewards.createdAt))
    .limit(20);
  const sum = (status?: string) =>
    rewards.filter((r) => !status || r.status === status).reduce((s, r) => s + toMinor(r.total), 0n);
  const levels = await db.select().from(referralLevels).orderBy(asc(referralLevels.level));
  const cfg = await getConfig("referral");
  return {
    code: me?.referralCode ?? "",
    counts: { l1: l1.length, l2: l2.length, l3: l3.length },
    directReferrals: l1.slice(0, 20).map((r) => ({
      id: r.id,
      name: maskName(r.name),
      joined: r.createdAt,
      qualified: toMinor(r.totalDeposits) >= toMinor(cfg.qualifyingDepositMin),
    })),
    totals: { pending: sum("PENDING") + sum("HELD"), settled: sum("SETTLED"), all: sum() - sum("REVERSED") },
    recentRewards,
    levels,
    config: cfg,
  };
}

export function maskName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.map((p, i) => (i === 0 ? p : `${p[0] ?? ""}.`)).join(" ");
}
