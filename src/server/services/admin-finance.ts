import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { cashRewards, deposits, financialAccounts, ledgerEntries, ledgerTransactions, profiles, withdrawals } from "@/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { formatCredits, toDecimal, toMinor } from "@/lib/money";
import { fmtCash } from "@/lib/format-money";
import { audit } from "./audit";
import { postTransaction, USER_ACCOUNT_CURRENCY, type UserAccountType } from "./ledger";
import { notify } from "./notifications";

type Actor = { id: string; role: string };

export const ADJUSTABLE_ACCOUNTS: UserAccountType[] = ["CASH", "CREDITS", "WITHDRAWABLE"];

/** Manual adjustment: a new balanced ledger transaction against SYS_ADJUSTMENT. History is never edited. */
export async function createAdjustment(
  actor: Actor,
  input: {
    userId: string;
    account: UserAccountType;
    direction: "CREDIT" | "DEBIT";
    amount: string;
    reason: string;
    note: string;
    idempotencyKey: string;
  },
) {
  if (!ADJUSTABLE_ACCOUNTS.includes(input.account)) throw new AppError("This account cannot be adjusted manually");
  if (input.reason.trim().length < 5) throw new AppError("Please give a clear reason (5+ characters)");
  const currency = USER_ACCOUNT_CURRENCY[input.account];
  const amount = toMinor(input.amount, currency);
  if (amount <= 0n) throw new AppError("Amount must be greater than zero");
  const signed = input.direction === "CREDIT" ? amount : -amount;
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(profiles).where(eq(profiles.id, input.userId)).limit(1);
    if (!user) throw new NotFoundError("User not found");
    const posted = await postTransaction(tx, {
      type: "ADJUSTMENT",
      userId: input.userId,
      idempotencyKey: `adjustment:${input.idempotencyKey}`,
      description: `Manual adjustment: ${input.reason}`,
      sourceType: "adjustment",
      sourceId: input.idempotencyKey,
      rewardSource: "ADJUSTMENT",
      createdBy: actor.id,
      metadata: { note: input.note, direction: input.direction },
      entries: [
        { userId: input.userId, account: input.account, amount: signed },
        { account: "SYS_ADJUSTMENT", currency, amount: -signed },
      ],
    });
    if (posted.replayed) return posted;
    await audit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "ledger.adjustment",
      entityType: "ledger_transaction",
      entityId: posted.transactionId,
      after: { userId: input.userId, account: input.account, direction: input.direction, amount: toDecimal(amount, currency), note: input.note },
      reason: input.reason,
    });
    const display = currency === "MYR" ? await fmtCash(signed, { sign: true }) : `${formatCredits(signed, { sign: true })} Credits`;
    await notify(tx, input.userId, "WALLET", "Balance adjustment", `${display} ${input.account.toLowerCase()} adjustment: ${input.reason}`, "/app/wallet/transactions");
    return posted;
  });
}

export type ReconCheck = { key: string; label: string; ok: boolean; detail: string };

/** Verifies ledger integrity and ties subledgers (deposits, rewards, withdrawals) back to account balances. */
export async function runReconciliation(): Promise<ReconCheck[]> {
  const checks: ReconCheck[] = [];

  const perCurrency = await db
    .select({ currency: ledgerEntries.currency, total: sql<string>`coalesce(sum(${ledgerEntries.amount}),0)` })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.currency);
  const unbalancedCurrencies = perCurrency.filter((r) => toMinor(r.total) !== 0n);
  checks.push({
    key: "ledger_zero_sum",
    label: "Ledger sums to zero per currency",
    ok: unbalancedCurrencies.length === 0,
    detail: unbalancedCurrencies.length ? unbalancedCurrencies.map((r) => `${r.currency}: ${r.total}`).join(", ") : "All currencies balance",
  });

  const unbalancedTx = await db.execute(sql`
    select transaction_id, currency, sum(amount) as total from ledger_entries
    group by transaction_id, currency having sum(amount) <> 0 limit 20`);
  const unbalancedRows = (unbalancedTx as unknown as { rows: unknown[] }).rows ?? [];
  checks.push({
    key: "tx_balanced",
    label: "Every transaction is balanced",
    ok: unbalancedRows.length === 0,
    detail: unbalancedRows.length ? `${unbalancedRows.length} unbalanced transactions` : "All transactions balanced",
  });

  const mismatches = await db.execute(sql`
    select a.id, a.user_id, a.type, a.balance, coalesce(sum(e.amount), 0) as derived
    from financial_accounts a left join ledger_entries e on e.account_id = a.id
    where a.user_id is not null
    group by a.id having a.balance <> coalesce(sum(e.amount), 0) limit 20`);
  const mismatchRows = (mismatches as unknown as { rows: unknown[] }).rows ?? [];
  checks.push({
    key: "account_balances",
    label: "Account balances match ledger history",
    ok: mismatchRows.length === 0,
    detail: mismatchRows.length ? `${mismatchRows.length} accounts differ from their ledger` : "All user account balances match",
  });

  const negatives = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(financialAccounts)
    .where(and(isNotNull(financialAccounts.userId), sql`${financialAccounts.balance} < 0`));
  checks.push({ key: "non_negative", label: "No negative user balances", ok: (negatives[0]?.n ?? 0) === 0, detail: `${negatives[0]?.n ?? 0} negative accounts` });

  const sumAccounts = async (type: UserAccountType) => {
    const [r] = await db
      .select({ total: sql<string>`coalesce(sum(${financialAccounts.balance}),0)` })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.type, type), isNotNull(financialAccounts.userId)));
    return toMinor(r.total);
  };

  const [pendingRewards] = await db
    .select({ total: sql<string>`coalesce(sum(${cashRewards.amount}),0)` })
    .from(cashRewards)
    .where(inArray(cashRewards.status, ["PENDING", "HELD"]));
  const pendingBal = await sumAccounts("PENDING_REWARDS");
  checks.push({
    key: "pending_rewards",
    label: "Pending reward records match Pending Rewards balances",
    ok: toMinor(pendingRewards.total) === pendingBal,
    detail: `Records ${await fmtCash(pendingRewards.total)} / Balances ${await fmtCash(pendingBal)}`,
  });

  const [openW] = await db
    .select({ total: sql<string>`coalesce(sum(${withdrawals.amount}),0)` })
    .from(withdrawals)
    .where(inArray(withdrawals.status, ["PENDING", "REVIEW", "APPROVED", "PROCESSING"]));
  const wpBal = await sumAccounts("WITHDRAWAL_PENDING");
  checks.push({
    key: "withdrawals_pending",
    label: "Open withdrawals match Withdrawal Pending balances",
    ok: toMinor(openW.total) === wpBal,
    detail: `Withdrawals ${await fmtCash(openW.total)} / Balances ${await fmtCash(wpBal)}`,
  });

  const [approvedDeposits] = await db
    .select({ total: sql<string>`coalesce(sum(${deposits.amount}),0)` })
    .from(deposits)
    .where(eq(deposits.status, "APPROVED"));
  const [depositLedger] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amount}),0)` })
    .from(ledgerEntries)
    .innerJoin(ledgerTransactions, eq(ledgerTransactions.id, ledgerEntries.transactionId))
    .where(and(inArray(ledgerTransactions.type, ["DEPOSIT", "DEPOSIT_REVERSAL"]), eq(ledgerEntries.accountType, "CASH")));
  checks.push({
    key: "deposits",
    label: "Approved deposits match deposit ledger postings",
    ok: toMinor(approvedDeposits.total) === toMinor(depositLedger.total),
    detail: `Deposits ${await fmtCash(approvedDeposits.total)} / Ledger ${await fmtCash(depositLedger.total)}`,
  });

  return checks;
}
