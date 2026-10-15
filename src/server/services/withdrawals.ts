import { and, desc, eq, gte, notInArray, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { cashRewards, depositLevels, profiles, withdrawalAccounts, withdrawals } from "@/db/schema";
import { AppError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { minBig, toDecimal, toMinor } from "@/lib/money";
import { fmtCash } from "@/lib/format-money";
import { audit } from "./audit";
import { assertWithdrawalsAllowed, getRequestCountry } from "./country-access";
import { getConfig } from "./config";
import { getBalances, postTransaction } from "./ledger";
import { notify } from "./notifications";
import { hasOpenRisk, onWithdrawalAccountSignals } from "./risk";

type Actor = { id: string; role: string };
export type WithdrawalStatus = (typeof withdrawals.$inferSelect)["status"];

export type Eligibility = {
  eligible: boolean;
  reasons: string[];
  available: bigint;
  min: bigint;
  max: bigint;
  requiresReview: boolean;
};

/** Server-side withdrawal eligibility. The client only displays this, it never decides it. */
export async function getWithdrawalEligibility(userId: string, tx: DbOrTx = db): Promise<Eligibility> {
  const cfg = await getConfig("withdrawal", tx);
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile) throw new NotFoundError("Account not found");
  const balances = await getBalances(userId, tx);
  const reasons: string[] = [];
  if (profile.status !== "ACTIVE") reasons.push("Your account is suspended.");

  // Licence + country lock (live request geo, else signup country).
  const country = (await getRequestCountry()) ?? profile.signupCountry;
  try {
    await assertWithdrawalsAllowed(country, tx);
  } catch (err) {
    reasons.push(err instanceof Error ? err.message : "Withdrawals are not available in your country.");
  }

  // Identity check before first withdrawal: admin-reviewed ID + proof of address.
  if (profile.verificationStatus !== "VERIFIED" || !profile.idDocumentFileId || !profile.addressProofFileId) {
    reasons.push("Upload your ID and proof of address, then wait for admin approval before your first withdrawal.");
  } else if (cfg.requiresVerification || profile.verificationRequired) {
    // already verified with docs
  }
  const [level] = profile.depositLevelId
    ? await tx.select().from(depositLevels).where(eq(depositLevels.id, profile.depositLevelId)).limit(1)
    : [];
  if (level && !level.canWithdraw) reasons.push(`Withdrawals are not available at the ${level.name} level.`);
  if (cfg.minDepositLevelOrder > 0 && (level?.sortOrder ?? 0) < cfg.minDepositLevelOrder) {
    reasons.push("Your Deposit Level does not yet meet the withdrawal requirement.");
  }
  let min = toMinor(cfg.min);
  if (level?.withdrawalMin) min = toMinor(level.withdrawalMin) > min ? toMinor(level.withdrawalMin) : min;
  let dailyMax = toMinor(cfg.maxDaily);
  if (level?.withdrawalMaxDaily) dailyMax = minBig(dailyMax, toMinor(level.withdrawalMaxDaily));
  const since = new Date(Date.now() - 86_400_000);
  const [{ used }] = await tx
    .select({ used: sql<string>`coalesce(sum(${withdrawals.amount}), 0)` })
    .from(withdrawals)
    .where(and(eq(withdrawals.userId, userId), gte(withdrawals.createdAt, since), notInArray(withdrawals.status, ["REJECTED", "CANCELLED"])));
  const dailyLeft = dailyMax - toMinor(used);
  const max = minBig(minBig(toMinor(cfg.maxPerRequest), dailyLeft < 0n ? 0n : dailyLeft), balances.WITHDRAWABLE);
  if (balances.WITHDRAWABLE < min) reasons.push(`Your Withdrawable balance is below the ${await fmtCash(min)} minimum.`);
  else if (max < min) reasons.push("You've reached your withdrawal limit for the last 24 hours.");
  const requiresReview = profile.rewardsOnHold || (await hasOpenRisk(tx, userId, ["HIGH", "MEDIUM"]));
  return { eligible: reasons.length === 0, reasons, available: balances.WITHDRAWABLE, min, max: max < 0n ? 0n : max, requiresReview };
}

export async function addWithdrawalAccount(userId: string, input: { bankName: string; accountName: string; accountNumber: string }) {
  return db.transaction(async (tx) => {
    const number = input.accountNumber.replace(/\s+/g, "");
    const existing = await tx.select().from(withdrawalAccounts).where(and(eq(withdrawalAccounts.userId, userId), eq(withdrawalAccounts.archived, false)));
    if (existing.length >= 5) throw new AppError("You can save up to 5 withdrawal accounts");
    const [row] = await tx
      .insert(withdrawalAccounts)
      .values({ userId, bankName: input.bankName, accountName: input.accountName, accountNumber: number, isDefault: existing.length === 0 })
      .returning();
    await onWithdrawalAccountSignals(tx, userId, number);
    return row;
  });
}

export async function archiveWithdrawalAccount(userId: string, id: string) {
  await db.update(withdrawalAccounts).set({ archived: true, isDefault: false }).where(and(eq(withdrawalAccounts.id, id), eq(withdrawalAccounts.userId, userId)));
}

export async function setDefaultWithdrawalAccount(userId: string, id: string) {
  await db.transaction(async (tx) => {
    await tx.update(withdrawalAccounts).set({ isDefault: false }).where(eq(withdrawalAccounts.userId, userId));
    await tx.update(withdrawalAccounts).set({ isDefault: true }).where(and(eq(withdrawalAccounts.id, id), eq(withdrawalAccounts.userId, userId)));
  });
}

export async function requestWithdrawal(userId: string, input: { amount: string; withdrawalAccountId: string; idempotencyKey: string }) {
  const amount = toMinor(input.amount);
  if (amount <= 0n) throw new AppError("Enter an amount greater than zero");
  const findExisting = async () =>
    (await db.select().from(withdrawals).where(and(eq(withdrawals.userId, userId), eq(withdrawals.idempotencyKey, input.idempotencyKey))).limit(1))[0];
  const prior = await findExisting();
  if (prior) return prior;
  try {
    return await db.transaction(async (tx) => {
      const [lockedProfile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
      if (!lockedProfile) throw new NotFoundError("Account not found");
      await assertWithdrawalsAllowed((await getRequestCountry()) ?? lockedProfile.signupCountry, tx);
      const [account] = await tx
        .select()
        .from(withdrawalAccounts)
        .where(and(eq(withdrawalAccounts.id, input.withdrawalAccountId), eq(withdrawalAccounts.userId, userId), eq(withdrawalAccounts.archived, false)))
        .limit(1);
      if (!account) throw new AppError("Choose a valid withdrawal account");
      const elig = await getWithdrawalEligibility(userId, tx);
      if (!elig.eligible) throw new AppError(elig.reasons[0] ?? "You are not eligible to withdraw right now");
      if (amount < elig.min) throw new AppError(`Minimum withdrawal is ${await fmtCash(elig.min)}`);
      if (amount > elig.max) throw new AppError(`Maximum withdrawal right now is ${await fmtCash(elig.max)}`);

      const id = crypto.randomUUID();
      const posted = await postTransaction(tx, {
        type: "WITHDRAWAL_REQUEST",
        userId,
        idempotencyKey: `withdrawal-request:${userId}:${input.idempotencyKey}`,
        description: `Withdrawal requested to ${account.bankName}`,
        sourceType: "withdrawal",
        sourceId: id,
        entries: [
          { userId, account: "WITHDRAWABLE", amount: -amount },
          { userId, account: "WITHDRAWAL_PENDING", amount },
        ],
      });
      const breakdownRows = await tx
        .select({ source: cashRewards.source, total: sql<string>`coalesce(sum(${cashRewards.amount}),0)` })
        .from(cashRewards)
        .where(and(eq(cashRewards.userId, userId), eq(cashRewards.status, "SETTLED")))
        .groupBy(cashRewards.source);
      const [row] = await tx
        .insert(withdrawals)
        .values({
          id,
          userId,
          withdrawalAccountId: account.id,
          amount: toDecimal(amount),
          status: elig.requiresReview ? "REVIEW" : "PENDING",
          accountSnapshot: { bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber },
          sourceBreakdown: Object.fromEntries(breakdownRows.map((r) => [r.source, r.total])),
          idempotencyKey: input.idempotencyKey,
          requestTransactionId: posted.transactionId,
        })
        .returning();
      await notify(tx, userId, "WALLET", "Withdrawal requested", `Your ${await fmtCash(amount)} withdrawal is being processed.`, "/wallet/transactions");
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const row = await findExisting();
      if (row) return row;
    }
    throw err;
  }
}

async function returnFunds(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], w: typeof withdrawals.$inferSelect, key: string, reason: string, actorId: string | null) {
  const amount = toMinor(w.amount);
  await postTransaction(tx, {
    type: "WITHDRAWAL_RETURN",
    userId: w.userId,
    idempotencyKey: `withdrawal-return:${w.id}:${key}`,
    description: `Withdrawal returned: ${reason}`,
    sourceType: "withdrawal",
    sourceId: w.id,
    reversesId: w.requestTransactionId ?? undefined,
    createdBy: actorId,
    entries: [
      { userId: w.userId, account: "WITHDRAWAL_PENDING", amount: -amount },
      { userId: w.userId, account: "WITHDRAWABLE", amount },
    ],
  });
}

export async function cancelWithdrawal(userId: string, id: string) {
  return db.transaction(async (tx) => {
    const [w] = await tx.select().from(withdrawals).where(and(eq(withdrawals.id, id), eq(withdrawals.userId, userId))).for("update");
    if (!w) throw new NotFoundError("Withdrawal not found");
    if (w.status !== "PENDING") throw new AppError("This withdrawal can no longer be cancelled");
    await returnFunds(tx, w, "cancel", "Cancelled by user", null);
    await tx.update(withdrawals).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(withdrawals.id, id));
  });
}

const TRANSITIONS: Record<string, { from: WithdrawalStatus[]; to: WithdrawalStatus }> = {
  review: { from: ["PENDING"], to: "REVIEW" },
  approve: { from: ["PENDING", "REVIEW"], to: "APPROVED" },
  process: { from: ["APPROVED"], to: "PROCESSING" },
  complete: { from: ["PROCESSING"], to: "COMPLETED" },
  reject: { from: ["PENDING", "REVIEW", "APPROVED", "PROCESSING"], to: "REJECTED" },
  reverse: { from: ["COMPLETED"], to: "REJECTED" },
};

export type WithdrawalAction = keyof typeof TRANSITIONS;

/** Admin state machine for withdrawals. Every money-moving transition posts a balanced ledger entry. */
export async function transitionWithdrawal(
  actor: Actor,
  id: string,
  action: WithdrawalAction,
  opts: { note?: string; payoutReference?: string } = {},
) {
  const t = TRANSITIONS[action];
  if (!t) throw new AppError("Unknown action");
  return db.transaction(async (tx) => {
    const [w] = await tx.select().from(withdrawals).where(eq(withdrawals.id, id)).for("update");
    if (!w) throw new NotFoundError("Withdrawal not found");
    if (w.status === t.to && action !== "reverse") return w;
    if (!t.from.includes(w.status)) throw new AppError(`Cannot ${action} a ${w.status.toLowerCase()} withdrawal`);
    if (["reject", "reverse"].includes(action) && !opts.note) throw new AppError("A reason is required");
    const patch: Partial<typeof withdrawals.$inferInsert> = { status: t.to, reviewerId: actor.id, updatedAt: new Date() };
    if (opts.note) patch.reviewNote = opts.note;
    const amount = toMinor(w.amount);
    if (action === "complete") {
      const posted = await postTransaction(tx, {
        type: "WITHDRAWAL_COMPLETE",
        userId: w.userId,
        idempotencyKey: `withdrawal-complete:${w.id}`,
        description: "Withdrawal paid out",
        sourceType: "withdrawal",
        sourceId: w.id,
        createdBy: actor.id,
        metadata: { payoutReference: opts.payoutReference ?? null },
        entries: [
          { userId: w.userId, account: "WITHDRAWAL_PENDING", amount: -amount },
          { account: "SYS_PAYOUT", currency: "MYR", amount },
        ],
      });
      patch.settleTransactionId = posted.transactionId;
      patch.completedAt = new Date();
      patch.payoutReference = opts.payoutReference ?? null;
    }
    if (action === "reject") await returnFunds(tx, w, "reject", opts.note!, actor.id);
    if (action === "reverse") {
      await postTransaction(tx, {
        type: "WITHDRAWAL_RETURN",
        userId: w.userId,
        idempotencyKey: `withdrawal-reverse:${w.id}`,
        description: `Payout reversed: ${opts.note}`,
        sourceType: "withdrawal",
        sourceId: w.id,
        reversesId: w.settleTransactionId ?? undefined,
        createdBy: actor.id,
        entries: [
          { account: "SYS_PAYOUT", currency: "MYR", amount: -amount },
          { userId: w.userId, account: "WITHDRAWABLE", amount },
        ],
      });
      patch.internalNote = `Payout reversed after completion: ${opts.note}`;
    }
    const [updated] = await tx.update(withdrawals).set(patch).where(eq(withdrawals.id, id)).returning();
    const messages: Partial<Record<WithdrawalAction, [string, string]>> = {
      approve: ["Withdrawal approved", `Your ${await fmtCash(amount)} withdrawal has been approved.`],
      complete: ["Withdrawal completed", `${await fmtCash(amount)} has been sent to your bank account.`],
      reject: ["Withdrawal returned", `Your ${await fmtCash(amount)} withdrawal was not processed and the funds are back in your Withdrawable balance. ${opts.note ?? ""}`],
      reverse: ["Payout reversed", `A ${await fmtCash(amount)} payout could not be delivered and has been returned to your Withdrawable balance.`],
    };
    const msg = messages[action];
    if (msg) await notify(tx, w.userId, "WALLET", msg[0], msg[1], "/wallet/transactions");
    await audit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: `withdrawal.${action}`,
      entityType: "withdrawal",
      entityId: id,
      before: { status: w.status },
      after: { status: updated.status, payoutReference: updated.payoutReference },
      reason: opts.note ?? null,
    });
    return updated;
  });
}

export async function userWithdrawals(userId: string, limit = 20) {
  return db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt)).limit(limit);
}

export async function userWithdrawalAccounts(userId: string) {
  return db
    .select()
    .from(withdrawalAccounts)
    .where(and(eq(withdrawalAccounts.userId, userId), eq(withdrawalAccounts.archived, false)))
    .orderBy(desc(withdrawalAccounts.isDefault));
}

export const OPEN_WITHDRAWAL_STATUSES: WithdrawalStatus[] = ["PENDING", "REVIEW", "APPROVED", "PROCESSING"];
