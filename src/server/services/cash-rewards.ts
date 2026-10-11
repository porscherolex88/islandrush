import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { cashRewards, profiles } from "@/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { toMinor } from "@/lib/money";
import { fmtCash } from "@/lib/format-money";
import { audit } from "./audit";
import { postTransaction } from "./ledger";
import { notify } from "./notifications";

type Actor = { id: string; role: string };

/** Moves eligible Pending Rewards into Withdrawable. Idempotent per reward. */
export async function settleDueRewards(opts: { userId?: string; limit?: number } = {}) {
  const due = await db
    .select({ id: cashRewards.id })
    .from(cashRewards)
    .where(
      and(
        eq(cashRewards.status, "PENDING"),
        lte(cashRewards.settleAfter, new Date()),
        opts.userId ? eq(cashRewards.userId, opts.userId) : undefined,
      ),
    )
    .limit(opts.limit ?? 500);
  let settled = 0;
  let held = 0;
  for (const { id } of due) {
    const outcome = await db.transaction(async (tx) => {
      const [reward] = await tx.select().from(cashRewards).where(eq(cashRewards.id, id)).for("update");
      if (!reward || reward.status !== "PENDING" || reward.settleAfter > new Date()) return "skip";
      const [profile] = await tx.select().from(profiles).where(eq(profiles.id, reward.userId)).limit(1);
      if (!profile || profile.rewardsOnHold || profile.status !== "ACTIVE") {
        await tx
          .update(cashRewards)
          .set({ status: "HELD", heldReason: "Held for account review", updatedAt: new Date() })
          .where(eq(cashRewards.id, id));
        return "held";
      }
      const amount = toMinor(reward.amount);
      const posted = await postTransaction(tx, {
        type: "SETTLEMENT",
        userId: reward.userId,
        idempotencyKey: `settle:${reward.id}`,
        description: `Reward settled (${reward.source})`,
        sourceType: "cash_reward",
        sourceId: reward.id,
        rewardSource: reward.source,
        entries: [
          { userId: reward.userId, account: "PENDING_REWARDS", amount: -amount },
          { userId: reward.userId, account: "WITHDRAWABLE", amount },
        ],
      });
      await tx
        .update(cashRewards)
        .set({ status: "SETTLED", settleTransactionId: posted.transactionId, settledAt: new Date(), updatedAt: new Date() })
        .where(eq(cashRewards.id, id));
      await notify(tx, reward.userId, "WALLET", "Reward now withdrawable", `${await fmtCash(reward.amount)} moved to your Withdrawable balance.`, "/wallet");
      return "settled";
    });
    if (outcome === "settled") settled++;
    if (outcome === "held") held++;
  }
  return { checked: due.length, settled, held };
}

export async function holdCashReward(actor: Actor, id: string, reason: string) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(cashRewards).where(eq(cashRewards.id, id)).for("update");
    if (!r) throw new NotFoundError("Reward not found");
    if (r.status !== "PENDING") throw new AppError("Only pending rewards can be held");
    await tx.update(cashRewards).set({ status: "HELD", heldReason: reason, updatedAt: new Date() }).where(eq(cashRewards.id, id));
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "reward.hold", entityType: "cash_reward", entityId: id, before: { status: r.status }, after: { status: "HELD" }, reason });
  });
}

export async function releaseCashReward(actor: Actor, id: string, reason: string) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(cashRewards).where(eq(cashRewards.id, id)).for("update");
    if (!r) throw new NotFoundError("Reward not found");
    if (r.status !== "HELD") throw new AppError("Only held rewards can be released");
    await tx.update(cashRewards).set({ status: "PENDING", heldReason: null, updatedAt: new Date() }).where(eq(cashRewards.id, id));
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "reward.release", entityType: "cash_reward", entityId: id, before: { status: r.status }, after: { status: "PENDING" }, reason });
  });
}

/** Reverses a reward with a compensating ledger entry. Historical entries are never edited. */
export async function reverseCashReward(actor: Actor, id: string, reason: string) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(cashRewards).where(eq(cashRewards.id, id)).for("update");
    if (!r) throw new NotFoundError("Reward not found");
    if (r.status === "REVERSED") throw new AppError("Reward is already reversed");
    const amount = toMinor(r.amount);
    const expense = r.source.startsWith("REFERRAL") ? "SYS_REFERRAL_EXPENSE" : "SYS_REWARD_EXPENSE";
    const from = r.status === "SETTLED" ? "WITHDRAWABLE" : "PENDING_REWARDS";
    const posted = await postTransaction(tx, {
      type: "REWARD_REVERSAL",
      userId: r.userId,
      idempotencyKey: `reverse-reward:${r.id}`,
      description: `Reward reversed: ${reason}`,
      sourceType: "cash_reward",
      sourceId: r.id,
      rewardSource: r.source,
      reversesId: r.settleTransactionId ?? r.creditTransactionId ?? undefined,
      createdBy: actor.id,
      entries: [
        { userId: r.userId, account: from, amount: -amount },
        { account: expense, currency: "MYR", amount },
      ],
    });
    await tx
      .update(cashRewards)
      .set({ status: "REVERSED", reverseTransactionId: posted.transactionId, heldReason: reason, updatedAt: new Date() })
      .where(eq(cashRewards.id, id));
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "reward.reverse", entityType: "cash_reward", entityId: id, before: { status: r.status }, after: { status: "REVERSED" }, reason });
  });
}

export async function setUserRewardHold(actor: Actor, userId: string, onHold: boolean, reason: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw new NotFoundError("User not found");
    await tx.update(profiles).set({ rewardsOnHold: onHold, updatedAt: new Date() }).where(eq(profiles.id, userId));
    if (onHold) {
      await tx
        .update(cashRewards)
        .set({ status: "HELD", heldReason: reason, updatedAt: new Date() })
        .where(and(eq(cashRewards.userId, userId), eq(cashRewards.status, "PENDING")));
    } else {
      await tx
        .update(cashRewards)
        .set({ status: "PENDING", heldReason: null, updatedAt: new Date() })
        .where(and(eq(cashRewards.userId, userId), inArray(cashRewards.status, ["HELD"])));
    }
    await audit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: onHold ? "user.reward_hold" : "user.reward_release",
      entityType: "profile",
      entityId: userId,
      before: { rewardsOnHold: p.rewardsOnHold },
      after: { rewardsOnHold: onHold },
      reason,
    });
  });
}
