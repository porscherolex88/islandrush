import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { cashRewards, ledgerEntries, ledgerTransactions } from "@/db/schema";
import type { UserAccountType } from "@/server/services/ledger";

export type ActivityRow = {
  id: string;
  createdAt: Date;
  type: string;
  description: string;
  entries: { account: UserAccountType; currency: "MYR" | "CREDITS"; amount: string }[];
};

/** A user's ledger activity grouped per transaction, newest first. Only the user's own account legs are exposed. */
export async function ledgerActivity(userId: string, opts: { limit?: number; offset?: number; account?: UserAccountType } = {}) {
  const limit = opts.limit ?? 20;
  const txs = await db
    .selectDistinct({ id: ledgerTransactions.id, createdAt: ledgerTransactions.createdAt, type: ledgerTransactions.type, description: ledgerTransactions.description })
    .from(ledgerTransactions)
    .innerJoin(ledgerEntries, eq(ledgerEntries.transactionId, ledgerTransactions.id))
    .where(and(eq(ledgerEntries.userId, userId), isNotNull(ledgerEntries.userId), opts.account ? eq(ledgerEntries.accountType, opts.account) : undefined))
    .orderBy(desc(ledgerTransactions.createdAt), desc(ledgerTransactions.id))
    .limit(limit + 1)
    .offset(opts.offset ?? 0);
  const ids = txs.slice(0, limit).map((t) => t.id);
  const entries = ids.length
    ? await db
        .select({ transactionId: ledgerEntries.transactionId, account: ledgerEntries.accountType, currency: ledgerEntries.currency, amount: ledgerEntries.amount })
        .from(ledgerEntries)
        .where(and(inArray(ledgerEntries.transactionId, ids), eq(ledgerEntries.userId, userId)))
    : [];
  const rows: ActivityRow[] = txs.slice(0, limit).map((t) => ({
    ...t,
    entries: entries
      .filter((e) => e.transactionId === t.id)
      .map((e) => ({ account: e.account as UserAccountType, currency: e.currency, amount: e.amount })),
  }));
  return { rows, hasMore: txs.length > limit };
}

export async function pendingCashRewards(userId: string) {
  return db
    .select()
    .from(cashRewards)
    .where(and(eq(cashRewards.userId, userId), inArray(cashRewards.status, ["PENDING", "HELD"])))
    .orderBy(desc(cashRewards.createdAt))
    .limit(20);
}
