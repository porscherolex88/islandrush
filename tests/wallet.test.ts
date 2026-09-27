import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLogs, cashRewards, deposits, profiles } from "@/db/schema";
import { createAdjustment, runReconciliation } from "@/server/services/admin-finance";
import { reverseCashReward, settleDueRewards } from "@/server/services/cash-rewards";
import { convertCashToCredits } from "@/server/services/conversion";
import { approveDeposit, createDeposit, rejectDeposit, reverseDeposit } from "@/server/services/deposits";
import { getBalances } from "@/server/services/ledger";
import { createCashReward } from "@/server/services/rewards";
import {
  addWithdrawalAccount,
  cancelWithdrawal,
  getWithdrawalEligibility,
  requestWithdrawal,
  transitionWithdrawal,
} from "@/server/services/withdrawals";
import { admin, ensureAdminActor, fundCash, makeUser, seedProgression, setConfigRaw, uid } from "./helpers";

beforeAll(async () => {
  await seedProgression();
  await ensureAdminActor();
});

async function giveWithdrawable(userId: string, amount: string) {
  await db.transaction((tx) =>
    createCashReward(tx, { userId, amount, source: "GAME_REWARD", sourceType: "test", sourceId: uid(), key: uid("reward"), description: "Test reward", pendingHours: 0 }),
  );
  await settleDueRewards({ userId });
}

describe("manual deposits", () => {
  it("only credits Cash after admin approval, and approval is idempotent", async () => {
    const u = await makeUser();
    const dep = await createDeposit(u.id, { amount: "1000.00", reference: "BANK123", payerName: "Ali", method: "BANK_TRANSFER", idempotencyKey: uid() });
    expect(dep.status).toBe("PENDING");
    expect((await getBalances(u.id)).CASH).toBe(0n);
    const [a, b] = await Promise.all([approveDeposit(admin, dep.id), approveDeposit(admin, dep.id)]);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    expect((await getBalances(u.id)).CASH).toBe(100000n);
    const [p] = await db.select().from(profiles).where(eq(profiles.id, u.id));
    expect(p.totalDeposits).toBe("1000.00");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, dep.id));
    expect(logs.some((l) => l.action === "deposit.approve")).toBe(true);
  });

  it("deduplicates client submissions with the same idempotency key", async () => {
    const u = await makeUser();
    const key = uid();
    const a = await createDeposit(u.id, { amount: "100.00", reference: "X", payerName: "A", method: "BANK_TRANSFER", idempotencyKey: key });
    const b = await createDeposit(u.id, { amount: "100.00", reference: "X", payerName: "A", method: "BANK_TRANSFER", idempotencyKey: key });
    expect(b.id).toBe(a.id);
  });

  it("enforces limits and supports reject and reversal", async () => {
    const u = await makeUser();
    await expect(createDeposit(u.id, { amount: "1.00", reference: "X", payerName: "A", method: "BANK_TRANSFER", idempotencyKey: uid() })).rejects.toThrow(/Minimum/);
    const rej = await createDeposit(u.id, { amount: "100.00", reference: "R", payerName: "A", method: "BANK_TRANSFER", idempotencyKey: uid() });
    await rejectDeposit(admin, rej.id, "No matching transfer");
    await expect(approveDeposit(admin, rej.id)).rejects.toThrow();
    const dep = await fundCash(u.id, "200.00");
    await reverseDeposit(admin, dep.id, "Bounced");
    expect((await getBalances(u.id)).CASH).toBe(0n);
    const [d] = await db.select().from(deposits).where(eq(deposits.id, dep.id));
    expect(d.status).toBe("REVERSED");
  });
});

describe("credit conversion", () => {
  it("converts RM1,000 to 60,000 Credits atomically and idempotently", async () => {
    const u = await makeUser();
    await fundCash(u.id, "1000.00");
    const key = uid();
    const [a, b] = await Promise.all([
      convertCashToCredits(u.id, { cashAmount: "1000.00", idempotencyKey: key }),
      convertCashToCredits(u.id, { cashAmount: "1000.00", idempotencyKey: key }),
    ]);
    expect(a.conversion.id).toBe(b.conversion.id);
    const bal = await getBalances(u.id);
    expect(bal.CASH).toBe(0n);
    expect(bal.CREDITS).toBe(60000n);
  });

  it("rejects conversions larger than the Cash balance", async () => {
    const u = await makeUser();
    await fundCash(u.id, "100.00");
    await expect(convertCashToCredits(u.id, { cashAmount: "100.01", idempotencyKey: uid() })).rejects.toThrow(/Insufficient/);
  });

  it("uses the configured rate", async () => {
    await setConfigRaw("conversion", { cash: "100.00", credits: 5000 });
    const u = await makeUser();
    await fundCash(u.id, "100.00");
    await convertCashToCredits(u.id, { cashAmount: "50.00", idempotencyKey: uid() });
    expect((await getBalances(u.id)).CREDITS).toBe(2500n);
    await setConfigRaw("conversion", { cash: "1000.00", credits: 60000 });
  });
});

describe("reward settlement", () => {
  it("moves pending rewards to withdrawable after the pending period", async () => {
    const u = await makeUser();
    await db.transaction((tx) =>
      createCashReward(tx, { userId: u.id, amount: "150.00", source: "GAME_REWARD", sourceType: "test", sourceId: "x", key: uid(), description: "Win", pendingHours: 24 }),
    );
    expect((await getBalances(u.id)).PENDING_REWARDS).toBe(15000n);
    await settleDueRewards({ userId: u.id });
    expect((await getBalances(u.id)).WITHDRAWABLE).toBe(0n);
    await db.update(cashRewards).set({ settleAfter: new Date(Date.now() - 1000) }).where(eq(cashRewards.userId, u.id));
    const r1 = await settleDueRewards({ userId: u.id });
    const r2 = await settleDueRewards({ userId: u.id });
    expect(r1.settled).toBe(1);
    expect(r2.settled).toBe(0);
    const bal = await getBalances(u.id);
    expect(bal.PENDING_REWARDS).toBe(0n);
    expect(bal.WITHDRAWABLE).toBe(15000n);
  });

  it("holds rewards for accounts on hold and supports reversal", async () => {
    const u = await makeUser();
    await db.update(profiles).set({ rewardsOnHold: true }).where(eq(profiles.id, u.id));
    const row = await db.transaction((tx) =>
      createCashReward(tx, { userId: u.id, amount: "20.00", source: "GAME_REWARD", sourceType: "test", sourceId: "x", key: uid(), description: "Win", pendingHours: 0 }),
    );
    expect(row?.status).toBe("HELD");
    await settleDueRewards({ userId: u.id });
    expect((await getBalances(u.id)).WITHDRAWABLE).toBe(0n);
    await reverseCashReward(admin, row!.id, "Policy breach");
    expect((await getBalances(u.id)).PENDING_REWARDS).toBe(0n);
  });
});

describe("withdrawals", () => {
  it("validates eligibility and limits", async () => {
    const u = await makeUser();
    const acct = await addWithdrawalAccount(u.id, { bankName: "Maybank", accountName: "Test", accountNumber: uid("acct") });
    let elig = await getWithdrawalEligibility(u.id);
    expect(elig.eligible).toBe(false);
    await giveWithdrawable(u.id, "500.00");
    elig = await getWithdrawalEligibility(u.id);
    expect(elig.eligible).toBe(true);
    await expect(requestWithdrawal(u.id, { amount: "10.00", withdrawalAccountId: acct.id, idempotencyKey: uid() })).rejects.toThrow(/Minimum/);
    await expect(requestWithdrawal(u.id, { amount: "600.00", withdrawalAccountId: acct.id, idempotencyKey: uid() })).rejects.toThrow(/Maximum/);
  });

  it("requires verification when configured", async () => {
    await setConfigRaw("withdrawal", { requiresVerification: true });
    const u = await makeUser();
    await giveWithdrawable(u.id, "100.00");
    const elig = await getWithdrawalEligibility(u.id);
    expect(elig.eligible).toBe(false);
    expect(elig.reasons.join(" ")).toMatch(/verification/);
    await setConfigRaw("withdrawal", { requiresVerification: false });
  });

  it("processes the full lifecycle through the ledger", async () => {
    const u = await makeUser();
    const acct = await addWithdrawalAccount(u.id, { bankName: "CIMB", accountName: "Test", accountNumber: uid("acct") });
    await giveWithdrawable(u.id, "300.00");
    const key = uid();
    const w = await requestWithdrawal(u.id, { amount: "150.00", withdrawalAccountId: acct.id, idempotencyKey: key });
    const again = await requestWithdrawal(u.id, { amount: "150.00", withdrawalAccountId: acct.id, idempotencyKey: key });
    expect(again.id).toBe(w.id);
    let bal = await getBalances(u.id);
    expect(bal.WITHDRAWABLE).toBe(15000n);
    expect(bal.WITHDRAWAL_PENDING).toBe(15000n);

    await expect(transitionWithdrawal(admin, w.id, "complete")).rejects.toThrow();
    await transitionWithdrawal(admin, w.id, "approve");
    await transitionWithdrawal(admin, w.id, "process");
    const done = await transitionWithdrawal(admin, w.id, "complete", { payoutReference: "TRX1" });
    expect(done.status).toBe("COMPLETED");
    bal = await getBalances(u.id);
    expect(bal.WITHDRAWAL_PENDING).toBe(0n);
    expect(bal.WITHDRAWABLE).toBe(15000n);

    const w2 = await requestWithdrawal(u.id, { amount: "100.00", withdrawalAccountId: acct.id, idempotencyKey: uid() });
    await expect(transitionWithdrawal(admin, w2.id, "reject")).rejects.toThrow(/reason/);
    await transitionWithdrawal(admin, w2.id, "reject", { note: "Name mismatch" });
    expect((await getBalances(u.id)).WITHDRAWABLE).toBe(15000n);

    const w3 = await requestWithdrawal(u.id, { amount: "50.00", withdrawalAccountId: acct.id, idempotencyKey: uid() });
    await cancelWithdrawal(u.id, w3.id);
    expect((await getBalances(u.id)).WITHDRAWABLE).toBe(15000n);

    const checks = await runReconciliation();
    for (const c of checks) expect(c.ok, `${c.key}: ${c.detail}`).toBe(true);
  });
});

describe("manual adjustments", () => {
  it("posts balanced, audited, idempotent adjustments and cannot overdraw", async () => {
    const u = await makeUser();
    const key = uid();
    await createAdjustment(admin, { userId: u.id, account: "CREDITS", direction: "CREDIT", amount: "500", reason: "Goodwill credit", note: "Ticket 1", idempotencyKey: key });
    await createAdjustment(admin, { userId: u.id, account: "CREDITS", direction: "CREDIT", amount: "500", reason: "Goodwill credit", note: "Ticket 1", idempotencyKey: key });
    expect((await getBalances(u.id)).CREDITS).toBe(500n);
    await expect(
      createAdjustment(admin, { userId: u.id, account: "CASH", direction: "DEBIT", amount: "1.00", reason: "Correction", note: "", idempotencyKey: uid() }),
    ).rejects.toThrow(/Insufficient/);
    await expect(
      createAdjustment(admin, { userId: u.id, account: "PENDING_REWARDS", direction: "CREDIT", amount: "1.00", reason: "Nope nope", note: "", idempotencyKey: uid() }),
    ).rejects.toThrow(/cannot be adjusted/);
  });
});
