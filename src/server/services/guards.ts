import { and, eq, gte, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { financialAccounts, ledgerEntries, profiles } from "@/db/schema";
import { AppError, ForbiddenError } from "@/lib/errors";
import { ensureUserAccounts } from "./ledger";

/** Locks the user's profile and Credits account so concurrent game actions for one user are serialized. */
export async function lockPlayer(tx: Tx, userId: string) {
  await ensureUserAccounts(tx, userId);
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
  if (!profile) throw new ForbiddenError("Account not found");
  if (profile.status !== "ACTIVE") throw new ForbiddenError("Your account is suspended. Please contact support.");
  const until = profile.playLimits?.selfExcludedUntil;
  if (until && new Date(until) > new Date()) {
    throw new AppError(`You've paused play until ${new Date(until).toLocaleDateString("en-MY")}.`, "SELF_EXCLUDED", 403);
  }
  await tx
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.type, "CREDITS")))
    .for("update");
  return profile;
}

/** Enforces the user's self-set daily Credit spend limit (Responsible Play). */
export async function assertWithinSpendLimit(tx: Tx, profile: typeof profiles.$inferSelect, additional: bigint) {
  const limit = profile.playLimits?.dailyCreditLimit;
  if (!limit || additional <= 0n) return;
  const since = new Date(Date.now() - 24 * 3_600_000);
  const [row] = await tx
    .select({ spent: sql<string>`coalesce(sum(-${ledgerEntries.amount}), 0)` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.userId, profile.id),
        eq(ledgerEntries.accountType, "CREDITS"),
        sql`${ledgerEntries.amount} < 0`,
        gte(ledgerEntries.createdAt, since),
      ),
    );
  const spent = BigInt(Math.round(Number(row?.spent ?? 0)));
  if (spent + additional > BigInt(limit)) {
    throw new AppError(
      `This would exceed your daily play limit of ${limit.toLocaleString()} Credits. You can change it in Account > Responsible Play.`,
      "SPEND_LIMIT",
    );
  }
}
