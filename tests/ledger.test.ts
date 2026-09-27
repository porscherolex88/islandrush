import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLogs, ledgerEntries, ledgerTransactions } from "@/db/schema";
import { InsufficientFundsError } from "@/lib/errors";
import { cashMinorToCredits, creditsToCashMinor, formatMYR, toDecimal, toMinor } from "@/lib/money";
import { getBalances, postTransaction } from "@/server/services/ledger";
import { runReconciliation } from "@/server/services/admin-finance";
import { audit } from "@/server/services/audit";
import { fundCash, makeUser, seedProgression } from "./helpers";

beforeAll(async () => {
  await seedProgression();
});

describe("money helpers", () => {
  it("parses and formats without floating point", () => {
    expect(toMinor("1000.00")).toBe(100000n);
    expect(toMinor("0.1")).toBe(10n);
    expect(toMinor("8000.00", "CREDITS")).toBe(8000n);
    expect(toDecimal(12345n)).toBe("123.45");
    expect(toDecimal(-5n)).toBe("-0.05");
    expect(toDecimal(8000n, "CREDITS")).toBe("8000.00");
    expect(formatMYR("1250.5")).toBe("RM1,250.50");
    expect(() => toMinor("1.234")).toThrow();
  });

  it("converts at the seeded rate RM1,000 = 60,000 Credits", () => {
    expect(cashMinorToCredits(100000n, 100000n, 60000n)).toBe(60000n);
    expect(creditsToCashMinor(8000n, 100000n, 60000n)).toBe(13333n); // RM133.33
    expect(cashMinorToCredits(1n, 100000n, 60000n)).toBe(0n);
  });
});

describe("ledger", () => {
  it("rejects unbalanced transactions", async () => {
    const u = await makeUser();
    await expect(
      db.transaction((tx) =>
        postTransaction(tx, {
          type: "ADJUSTMENT",
          userId: u.id,
          idempotencyKey: `bad-${u.id}`,
          description: "bad",
          entries: [
            { userId: u.id, account: "CASH", amount: 100n },
            { account: "SYS_ADJUSTMENT", currency: "MYR", amount: -50n },
          ],
        }),
      ),
    ).rejects.toThrow(/Unbalanced/);
  });

  it("never allows negative user balances", async () => {
    const u = await makeUser();
    await expect(
      db.transaction((tx) =>
        postTransaction(tx, {
          type: "ADJUSTMENT",
          userId: u.id,
          idempotencyKey: `neg-${u.id}`,
          description: "overdraw",
          entries: [
            { userId: u.id, account: "CASH", amount: -1n },
            { account: "SYS_ADJUSTMENT", currency: "MYR", amount: 1n },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    const b = await getBalances(u.id);
    expect(b.CASH).toBe(0n);
  });

  it("is idempotent on the idempotency key", async () => {
    const u = await makeUser();
    const post = () =>
      db.transaction((tx) =>
        postTransaction(tx, {
          type: "ADJUSTMENT",
          userId: u.id,
          idempotencyKey: `idem-${u.id}`,
          description: "credit",
          entries: [
            { userId: u.id, account: "CASH", amount: 500n },
            { account: "SYS_ADJUSTMENT", currency: "MYR", amount: -500n },
          ],
        }),
      );
    const a = await post();
    const b = await post();
    expect(b.replayed).toBe(true);
    expect(b.transactionId).toBe(a.transactionId);
    expect((await getBalances(u.id)).CASH).toBe(500n);
  });

  it("records running balances on every entry and reconciles", async () => {
    const u = await makeUser();
    await fundCash(u.id, "100.00");
    await fundCash(u.id, "50.00");
    const entries = await db.select().from(ledgerEntries).where(sql`${ledgerEntries.userId} = ${u.id}`).orderBy(ledgerEntries.id);
    expect(entries.map((e) => e.balanceAfter)).toEqual(["100.00", "150.00"]);
    const checks = await runReconciliation();
    for (const c of checks) expect(c.ok, `${c.key}: ${c.detail}`).toBe(true);
  });

  it("prevents editing or deleting ledger history and audit logs", async () => {
    const u = await makeUser();
    await fundCash(u.id, "100.00");
    const appendOnly = (e: unknown) => /append-only/.test(String((e as { cause?: Error }).cause?.message ?? (e as Error).message));
    await expect(db.execute(sql`update ledger_entries set amount = 999 where user_id = ${u.id}`)).rejects.toSatisfy(appendOnly);
    await expect(db.execute(sql`delete from ledger_transactions where user_id = ${u.id}`)).rejects.toSatisfy(appendOnly);
    await audit(db, { actorId: null, action: "test", entityType: "test" });
    await expect(db.delete(auditLogs)).rejects.toSatisfy(appendOnly);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(ledgerTransactions);
    expect(n).toBeGreaterThan(0);
  });
});
