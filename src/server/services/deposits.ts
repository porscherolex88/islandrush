import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cashRewards, deposits, paymentAccounts, profiles } from "@/db/schema";
import { AppError, ForbiddenError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { toDecimal, toMinor } from "@/lib/money";
import { fmtCash } from "@/lib/format-money";
import { audit } from "./audit";
import { getConfig, isFeatureEnabled } from "./config";
import { recomputeDepositLevel } from "./deposit-levels";
import { postTransaction } from "./ledger";
import { notify } from "./notifications";
import { processReferralRewards } from "./referrals";
import { onDepositSignals } from "./risk";

type Actor = { id: string; role: string };

export const DEPOSITS_UNAVAILABLE_MESSAGE = "Deposits are temporarily unavailable.";

export async function listPaymentAccounts() {
  return db.select().from(paymentAccounts).where(eq(paymentAccounts.active, true)).orderBy(paymentAccounts.sortOrder);
}

/** A user-submitted deposit claim. It never moves money until an admin approves it. */
export async function createDeposit(
  userId: string,
  input: {
    amount: string;
    reference: string;
    payerName: string;
    method: string;
    paymentAccountId?: string | null;
    note?: string | null;
    proofFileId?: string | null;
    idempotencyKey: string;
  },
) {
  // Missing flag counts as off so deposits stay disabled until an admin turns them on.
  if (!(await isFeatureEnabled("deposits", db, false))) {
    throw new AppError(DEPOSITS_UNAVAILABLE_MESSAGE, "FEATURE_DISABLED", 503);
  }
  const cfg = await getConfig("deposit");
  const amount = toMinor(input.amount);
  if (amount < toMinor(cfg.min)) throw new AppError(`Minimum deposit is ${await fmtCash(cfg.min)}`);
  if (amount > toMinor(cfg.max)) throw new AppError(`Maximum deposit is ${await fmtCash(cfg.max)}`);
  if (cfg.proofRequired && !input.proofFileId) throw new AppError("Please upload your proof of transfer");
  if (!cfg.methods.includes(input.method)) throw new AppError("Unsupported deposit method");
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile || profile.status !== "ACTIVE") throw new ForbiddenError("Your account cannot make deposits right now");
  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(deposits)
    .where(and(eq(deposits.userId, userId), eq(deposits.status, "PENDING")));
  if (pending >= 5) throw new AppError("You have too many pending deposits. Please wait for them to be reviewed.");
  try {
    const [row] = await db
      .insert(deposits)
      .values({
        userId,
        amount: toDecimal(amount),
        reference: input.reference.trim(),
        payerName: input.payerName.trim(),
        method: input.method,
        paymentAccountId: input.paymentAccountId ?? null,
        userNote: input.note ?? null,
        proofFileId: input.proofFileId ?? null,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();
    await notify(db, userId, "WALLET", "Deposit submitted", `Your ${await fmtCash(row.amount)} deposit is pending review.`, "/wallet/transactions");
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      const [row] = await db
        .select()
        .from(deposits)
        .where(and(eq(deposits.userId, userId), eq(deposits.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (row) return row;
    }
    throw err;
  }
}

/** Approves a pending deposit and posts it to the Cash wallet. Idempotent and safe under concurrent approvals. */
export async function approveDeposit(actor: Actor, depositId: string, note?: string) {
  return db.transaction(async (tx) => {
    const [dep] = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
    if (!dep) throw new NotFoundError("Deposit not found");
    if (dep.status === "APPROVED") return { deposit: dep, replayed: true };
    if (dep.status !== "PENDING") throw new AppError(`Deposit is ${dep.status.toLowerCase()} and cannot be approved`);
    const amount = toMinor(dep.amount);
    const posted = await postTransaction(tx, {
      type: "DEPOSIT",
      userId: dep.userId,
      idempotencyKey: `deposit:${dep.id}`,
      description: `Deposit approved (${dep.method})`,
      sourceType: "deposit",
      sourceId: dep.id,
      createdBy: actor.id,
      entries: [
        { account: "SYS_DEPOSIT_CLEARING", currency: "MYR", amount: -amount },
        { userId: dep.userId, account: "CASH", amount },
      ],
    });
    const [updated] = await tx
      .update(deposits)
      .set({ status: "APPROVED", reviewerId: actor.id, reviewedAt: new Date(), reviewNote: note ?? null, ledgerTransactionId: posted.transactionId, updatedAt: new Date() })
      .where(eq(deposits.id, dep.id))
      .returning();
    await tx
      .update(profiles)
      .set({ totalDeposits: sql`${profiles.totalDeposits} + ${dep.amount}`, updatedAt: new Date() })
      .where(eq(profiles.id, dep.userId));
    await recomputeDepositLevel(tx, dep.userId);
    await processReferralRewards(tx, updated);
    await onDepositSignals(tx, updated);
    await notify(tx, dep.userId, "WALLET", "Deposit approved", `${await fmtCash(dep.amount)} has been added to your Cash wallet.`, "/wallet");
    await audit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "deposit.approve",
      entityType: "deposit",
      entityId: dep.id,
      before: { status: dep.status },
      after: { status: "APPROVED", ledgerTransactionId: posted.transactionId },
      reason: note ?? null,
    });
    return { deposit: updated, replayed: false };
  });
}

export async function rejectDeposit(actor: Actor, depositId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [dep] = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
    if (!dep) throw new NotFoundError("Deposit not found");
    if (dep.status !== "PENDING") throw new AppError("Only pending deposits can be rejected");
    await tx
      .update(deposits)
      .set({ status: "REJECTED", reviewerId: actor.id, reviewedAt: new Date(), reviewNote: reason, updatedAt: new Date() })
      .where(eq(deposits.id, dep.id));
    await notify(tx, dep.userId, "WALLET", "Deposit not approved", `Your ${await fmtCash(dep.amount)} deposit could not be verified: ${reason}`, "/wallet/transactions");
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "deposit.reject", entityType: "deposit", entityId: dep.id, before: { status: dep.status }, after: { status: "REJECTED" }, reason });
  });
}

/** Reverses an approved deposit (e.g. a bounced transfer) with a compensating ledger entry. */
export async function reverseDeposit(actor: Actor, depositId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [dep] = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
    if (!dep) throw new NotFoundError("Deposit not found");
    if (dep.status !== "APPROVED") throw new AppError("Only approved deposits can be reversed");
    const amount = toMinor(dep.amount);
    await postTransaction(tx, {
      type: "DEPOSIT_REVERSAL",
      userId: dep.userId,
      idempotencyKey: `deposit-reversal:${dep.id}`,
      description: `Deposit reversed: ${reason}`,
      sourceType: "deposit",
      sourceId: dep.id,
      reversesId: dep.ledgerTransactionId ?? undefined,
      createdBy: actor.id,
      entries: [
        { userId: dep.userId, account: "CASH", amount: -amount },
        { account: "SYS_DEPOSIT_CLEARING", currency: "MYR", amount },
      ],
    });
    await tx.update(deposits).set({ status: "REVERSED", internalNote: reason, updatedAt: new Date() }).where(eq(deposits.id, dep.id));
    await tx
      .update(profiles)
      .set({ totalDeposits: sql`greatest(0, ${profiles.totalDeposits} - ${dep.amount})`, updatedAt: new Date() })
      .where(eq(profiles.id, dep.userId));
    await recomputeDepositLevel(tx, dep.userId);
    const related = await tx
      .select()
      .from(cashRewards)
      .where(and(eq(cashRewards.depositId, dep.id), sql`${cashRewards.status} in ('PENDING','HELD')`));
    for (const r of related) {
      await postTransaction(tx, {
        type: "REWARD_REVERSAL",
        userId: r.userId,
        idempotencyKey: `reverse-reward:${r.id}`,
        description: "Referral reward reversed (source deposit reversed)",
        sourceType: "cash_reward",
        sourceId: r.id,
        rewardSource: r.source,
        createdBy: actor.id,
        entries: [
          { userId: r.userId, account: "PENDING_REWARDS", amount: -toMinor(r.amount) },
          { account: "SYS_REFERRAL_EXPENSE", currency: "MYR", amount: toMinor(r.amount) },
        ],
      });
      await tx.update(cashRewards).set({ status: "REVERSED", heldReason: "Source deposit reversed", updatedAt: new Date() }).where(eq(cashRewards.id, r.id));
    }
    await notify(tx, dep.userId, "WALLET", "Deposit reversed", `Your ${await fmtCash(dep.amount)} deposit was reversed. Contact support if you have questions.`, "/wallet/transactions");
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "deposit.reverse", entityType: "deposit", entityId: dep.id, before: { status: "APPROVED" }, after: { status: "REVERSED", reversedReferralRewards: related.length }, reason });
  });
}

export async function userDeposits(userId: string, limit = 20) {
  return db.select().from(deposits).where(eq(deposits.userId, userId)).orderBy(desc(deposits.createdAt)).limit(limit);
}
