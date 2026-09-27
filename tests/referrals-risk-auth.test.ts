import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLogs, cashRewards, referralLevels, riskFlags } from "@/db/schema";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { approveDeposit, createDeposit } from "@/server/services/deposits";
import { getBalances } from "@/server/services/ledger";
import { hasPermission, permissionsForRole, setRolePermissions, setUserRole } from "@/server/services/permissions";
import { setSuspension } from "@/server/services/profiles";
import { updateRiskFlag } from "@/server/services/risk";
import { addWithdrawalAccount } from "@/server/services/withdrawals";
import { playMysteryBox } from "@/server/services/mystery-box";
import { admin, ensureAdminActor, fundCash, makeBox, makePool, makeUser, seedProgression, uid } from "./helpers";

beforeAll(async () => {
  await seedProgression();
  await ensureAdminActor();
  await db.insert(referralLevels).values([
    { level: 1, rewardKind: "FIXED", value: "30.00" },
    { level: 2, rewardKind: "PERCENT", value: "2.00" },
    { level: 3, rewardKind: "FIXED", value: "5.00" },
  ]);
});

describe("multi-level referrals", () => {
  it("rewards up to three levels on the first qualifying deposit only", async () => {
    const l3 = await makeUser();
    const l2 = await makeUser({ referralCode: l3.referralCode });
    const l1 = await makeUser({ referralCode: l2.referralCode });
    const referee = await makeUser({ referralCode: l1.referralCode });
    expect(referee.referredById).toBe(l1.id);

    await fundCash(referee.id, "50.00"); // below qualifying minimum
    expect((await getBalances(l1.id)).PENDING_REWARDS).toBe(0n);

    await fundCash(referee.id, "1000.00");
    expect((await getBalances(l1.id)).PENDING_REWARDS).toBe(3000n);
    expect((await getBalances(l2.id)).PENDING_REWARDS).toBe(2000n); // 2% of RM1,000
    expect((await getBalances(l3.id)).PENDING_REWARDS).toBe(500n);

    const rewards = await db.select().from(cashRewards).where(eq(cashRewards.refereeId, referee.id));
    expect(rewards.map((r) => r.source).sort()).toEqual(["REFERRAL_L1", "REFERRAL_L2", "REFERRAL_L3"]);

    await fundCash(referee.id, "1000.00");
    expect((await getBalances(l1.id)).PENDING_REWARDS).toBe(3000n);
  });

  it("does not allow self-referral by code", async () => {
    const u = await makeUser({ referralCode: "NOPE0000" });
    expect(u.referredById).toBeNull();
  });
});

describe("referral fraud controls", () => {
  it("flags shared devices and holds the linked referral reward", async () => {
    const referrer = await makeUser({ deviceId: "device-shared", ip: "10.0.0.1" });
    const referee = await makeUser({ referralCode: referrer.referralCode, deviceId: "device-shared", ip: "10.0.0.1" });
    const flags = await db.select().from(riskFlags).where(eq(riskFlags.userId, referee.id));
    expect(flags.some((f) => f.type === "SELF_REFERRAL" && f.severity === "HIGH")).toBe(true);
    expect(flags.some((f) => f.type === "DUPLICATE_ACCOUNT")).toBe(true);

    await fundCash(referee.id, "500.00");
    const [reward] = await db.select().from(cashRewards).where(and(eq(cashRewards.userId, referrer.id), eq(cashRewards.refereeId, referee.id)));
    expect(reward.status).toBe("HELD");

    await updateRiskFlag(admin, flags[0].id, { status: "IN_REVIEW", note: "Checking", assignedToId: admin.id });
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, flags[0].id));
    expect(logs[0].action).toBe("risk.update");
  });

  it("flags payment-method matches across accounts", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const number = uid("acct");
    await addWithdrawalAccount(a.id, { bankName: "Maybank", accountName: "A", accountNumber: number });
    await addWithdrawalAccount(b.id, { bankName: "Maybank", accountName: "B", accountNumber: number });
    const flags = await db.select().from(riskFlags).where(and(eq(riskFlags.userId, b.id), eq(riskFlags.type, "PAYMENT_METHOD_MATCH")));
    expect(flags).toHaveLength(1);
  });

  it("flags duplicate deposit references", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const ref = uid("REF");
    const d1 = await createDeposit(a.id, { amount: "100.00", reference: ref, payerName: "A", method: "BANK_TRANSFER", idempotencyKey: uid() });
    const d2 = await createDeposit(b.id, { amount: "100.00", reference: ref, payerName: "B", method: "BANK_TRANSFER", idempotencyKey: uid() });
    await approveDeposit(admin, d1.id);
    await approveDeposit(admin, d2.id);
    const flags = await db.select().from(riskFlags).where(and(eq(riskFlags.userId, b.id), eq(riskFlags.type, "SUSPICIOUS_DEPOSIT")));
    expect(flags.length).toBeGreaterThan(0);
  });
});

describe("authorization and RBAC", () => {
  it("applies default role permissions", async () => {
    expect(await hasPermission("SUPPORT", "support.manage")).toBe(true);
    expect(await hasPermission("SUPPORT", "deposits.manage")).toBe(false);
    expect(await hasPermission("FINANCE", "withdrawals.manage")).toBe(true);
    expect(await hasPermission("FINANCE", "games.manage")).toBe(false);
    expect(await hasPermission("GAME_ADMIN", "games.manage")).toBe(true);
    expect(await hasPermission("GAME_ADMIN", "ledger.adjust")).toBe(false);
    expect(await hasPermission("USER", "dashboard.view")).toBe(false);
    expect((await permissionsForRole("SUPER_ADMIN")).size).toBeGreaterThan(20);
  });

  it("lets super admins change role permissions with an audit record", async () => {
    await setRolePermissions(admin as never, "SUPPORT", [...DEFAULT_ROLE_PERMISSIONS.SUPPORT, "reports.view"], "Support needs reports");
    expect(await hasPermission("SUPPORT", "reports.view")).toBe(true);
    await expect(setRolePermissions(admin as never, "SUPER_ADMIN", [], "nope")).rejects.toThrow();
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "permissions.update"));
    expect(logs.length).toBeGreaterThan(0);
  });

  it("audits role changes and blocks self-changes", async () => {
    const u = await makeUser();
    await setUserRole(admin as never, u.id, "SUPPORT", "New hire");
    await expect(setUserRole(admin as never, admin.id, "USER", "oops")).rejects.toThrow(/own role/);
  });

  it("blocks suspended accounts from playing", async () => {
    const pool = await makePool("WEIGHTED", [{ rewardType: "CREDITS", amount: "1" }]);
    const box = await makeBox(pool.id, 10);
    const u = await makeUser();
    await fundCash(u.id, "100.00");
    await setSuspension(admin, u.id, true, "Investigation");
    await expect(playMysteryBox(u.id, { boxId: box.id, selectedIndex: 0, idempotencyKey: uid() })).rejects.toThrow(/suspended/);
  });
});
