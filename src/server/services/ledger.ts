import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbOrTx, Tx } from "@/db";
import { db } from "@/db";
import { financialAccounts, ledgerEntries, ledgerTransactions } from "@/db/schema";
import { AppError, InsufficientFundsError } from "@/lib/errors";
import { toDecimal, toMinor, type Currency } from "@/lib/money";

export type UserAccountType = "CASH" | "CREDITS" | "PENDING_REWARDS" | "WITHDRAWABLE" | "WITHDRAWAL_PENDING";
export type SystemAccountType =
  | "SYS_DEPOSIT_CLEARING"
  | "SYS_CONVERSION"
  | "SYS_CREDIT_ISSUANCE"
  | "SYS_GAME_REVENUE"
  | "SYS_REWARD_EXPENSE"
  | "SYS_REFERRAL_EXPENSE"
  | "SYS_PAYOUT"
  | "SYS_ADJUSTMENT";
export type AccountType = UserAccountType | SystemAccountType;

export const USER_ACCOUNT_TYPES: UserAccountType[] = [
  "CASH",
  "CREDITS",
  "PENDING_REWARDS",
  "WITHDRAWABLE",
  "WITHDRAWAL_PENDING",
];

export const USER_ACCOUNT_CURRENCY: Record<UserAccountType, Currency> = {
  CASH: "MYR",
  CREDITS: "CREDITS",
  PENDING_REWARDS: "MYR",
  WITHDRAWABLE: "MYR",
  WITHDRAWAL_PENDING: "MYR",
};

export type LedgerTxType = (typeof ledgerTransactions.$inferInsert)["type"];
export type RewardSource = NonNullable<(typeof ledgerTransactions.$inferInsert)["rewardSource"]>;

export type EntryInput =
  | { userId: string; account: UserAccountType; amount: bigint }
  | { userId?: null; account: SystemAccountType; currency: Currency; amount: bigint };

export type PostInput = {
  type: LedgerTxType;
  userId: string | null;
  idempotencyKey: string;
  description: string;
  sourceType?: string;
  sourceId?: string;
  rewardSource?: RewardSource;
  reversesId?: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
  entries: EntryInput[];
};

export type PostResult = { transactionId: string; replayed: boolean };

export async function ensureUserAccounts(tx: DbOrTx, userId: string) {
  await tx
    .insert(financialAccounts)
    .values(
      USER_ACCOUNT_TYPES.map((type) => ({
        userId,
        type,
        currency: USER_ACCOUNT_CURRENCY[type],
        allowNegative: false,
      })),
    )
    .onConflictDoNothing();
}

async function systemAccountId(tx: Tx, type: SystemAccountType, currency: Currency): Promise<string> {
  const find = () =>
    tx
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(isNull(financialAccounts.userId), eq(financialAccounts.type, type), eq(financialAccounts.currency, currency)),
      )
      .limit(1);
  let [row] = await find();
  if (!row) {
    await tx.insert(financialAccounts).values({ userId: null, type, currency, allowNegative: true }).onConflictDoNothing();
    [row] = await find();
  }
  return row.id;
}

/**
 * Posts a balanced, immutable double-entry transaction.
 * - Idempotent on `idempotencyKey` (a replay returns the original transaction).
 * - Entries must sum to zero per currency.
 * - User accounts are row-locked (SELECT ... FOR UPDATE) and can never go negative.
 * Must be called inside a database transaction.
 */
export async function postTransaction(tx: Tx, input: PostInput): Promise<PostResult> {
  const [existing] = await tx
    .select({ id: ledgerTransactions.id })
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing) return { transactionId: existing.id, replayed: true };

  const entries = input.entries.filter((e) => e.amount !== 0n);
  if (entries.length < 2) throw new AppError("A ledger transaction needs at least two entries", "LEDGER_INVALID", 500);

  const sums = new Map<Currency, bigint>();
  for (const e of entries) {
    const currency = e.userId ? USER_ACCOUNT_CURRENCY[e.account as UserAccountType] : (e as { currency: Currency }).currency;
    sums.set(currency, (sums.get(currency) ?? 0n) + e.amount);
  }
  for (const [currency, sum] of sums) {
    if (sum !== 0n) throw new AppError(`Unbalanced ledger transaction (${currency})`, "LEDGER_UNBALANCED", 500);
  }

  const userIds = [...new Set(entries.filter((e) => e.userId).map((e) => e.userId as string))];
  for (const uid of userIds) await ensureUserAccounts(tx, uid);

  // Lock all involved user accounts in a stable order to avoid deadlocks.
  const userAccounts = userIds.length
    ? await tx
        .select()
        .from(financialAccounts)
        .where(inArray(financialAccounts.userId, userIds))
        .orderBy(financialAccounts.id)
        .for("update")
    : [];

  const [txRow] = await tx
    .insert(ledgerTransactions)
    .values({
      type: input.type,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      rewardSource: input.rewardSource,
      reversesId: input.reversesId,
      createdBy: input.createdBy ?? null,
      metadata: input.metadata ?? {},
    })
    .returning({ id: ledgerTransactions.id });

  const newBalances = new Map<string, bigint>();
  const rows: (typeof ledgerEntries.$inferInsert)[] = [];

  for (const e of entries) {
    if (e.userId) {
      const account = userAccounts.find((a) => a.userId === e.userId && a.type === e.account);
      if (!account) throw new AppError("Account not found", "LEDGER_ACCOUNT_MISSING", 500);
      const currency = USER_ACCOUNT_CURRENCY[e.account as UserAccountType];
      const current = newBalances.get(account.id) ?? toMinor(account.balance, currency);
      const next = current + e.amount;
      if (next < 0n && !account.allowNegative) {
        throw new InsufficientFundsError(
          e.account === "CREDITS" ? "Not enough Credits" : `Insufficient ${e.account.toLowerCase().replace("_", " ")} balance`,
        );
      }
      newBalances.set(account.id, next);
      rows.push({
        transactionId: txRow.id,
        accountId: account.id,
        userId: e.userId,
        accountType: e.account,
        currency,
        amount: toDecimal(e.amount, currency),
        balanceAfter: toDecimal(next, currency),
      });
    } else {
      const sys = e as { account: SystemAccountType; currency: Currency; amount: bigint };
      const accountId = await systemAccountId(tx, sys.account, sys.currency);
      rows.push({
        transactionId: txRow.id,
        accountId,
        userId: null,
        accountType: sys.account,
        currency: sys.currency,
        amount: toDecimal(sys.amount, sys.currency),
        balanceAfter: null,
      });
    }
  }

  for (const [accountId, balance] of newBalances) {
    const account = userAccounts.find((a) => a.id === accountId)!;
    await tx
      .update(financialAccounts)
      .set({ balance: toDecimal(balance, account.currency), updatedAt: new Date() })
      .where(eq(financialAccounts.id, accountId));
  }
  await tx.insert(ledgerEntries).values(rows);

  return { transactionId: txRow.id, replayed: false };
}

export type Balances = Record<UserAccountType, bigint>;

export async function getBalances(userId: string, tx: DbOrTx = db): Promise<Balances> {
  const rows = await tx
    .select({ type: financialAccounts.type, balance: financialAccounts.balance, currency: financialAccounts.currency })
    .from(financialAccounts)
    .where(eq(financialAccounts.userId, userId));
  const out: Balances = { CASH: 0n, CREDITS: 0n, PENDING_REWARDS: 0n, WITHDRAWABLE: 0n, WITHDRAWAL_PENDING: 0n };
  for (const r of rows) out[r.type as UserAccountType] = toMinor(r.balance, r.currency);
  return out;
}

/** Recomputes balances from ledger entries for integrity checks. */
export async function ledgerDerivedBalances(tx: DbOrTx = db) {
  return tx
    .select({
      accountId: ledgerEntries.accountId,
      total: sql<string>`sum(${ledgerEntries.amount})`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.accountId);
}
