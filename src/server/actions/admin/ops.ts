"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { deposits, featureFlags, notifications, profiles, withdrawals } from "@/db/schema";
import { isValidPercentSplit } from "@/lib/adventure";
import { adminAction, assertRecentAuth } from "@/lib/auth/session";
import { AppError, type ActionResult } from "@/lib/errors";
import { ALL_PERMISSIONS, ROLES, type Permission, type Role } from "@/lib/permissions";
import { ADJUSTABLE_ACCOUNTS, createAdjustment, runReconciliation, type ReconCheck } from "@/server/services/admin-finance";
import { audit } from "@/server/services/audit";
import { holdCashReward, releaseCashReward, reverseCashReward, setUserRewardHold } from "@/server/services/cash-rewards";
import { CONFIG_DEFAULTS, getConfig, setConfig, type ConfigKey } from "@/server/services/config";
import { approveDeposit, rejectDeposit, reverseDeposit } from "@/server/services/deposits";
import { JOBS, runJob, sendBroadcast, type JobName } from "@/server/services/jobs";
import { setRolePermissions, setUserRole } from "@/server/services/permissions";
import { addUserNote, setSuspension, setVerification } from "@/server/services/profiles";
import { flagRisk, updateRiskFlag } from "@/server/services/risk";
import { updatePrizeClaimStatus } from "@/server/services/adventure";
import { staffReply, updateTicket } from "@/server/services/support";
import { transitionWithdrawal, type WithdrawalAction } from "@/server/services/withdrawals";

const reasonSchema = z.string().trim().min(3, "Please give a reason").max(500);

async function reauth() {
  const cfg = await getConfig("admin_security");
  await assertRecentAuth(cfg.reauthMinutes);
}

/* --------------------------------- Deposits -------------------------------- */

export async function approveDepositAction(id: string, note: string | null) {
  return adminAction("deposits.manage", async ({ actor }) => {
    await approveDeposit(actor, id, note ?? undefined);
    return null;
  });
}

export async function rejectDepositAction(id: string, reason: string | null) {
  return adminAction("deposits.manage", async ({ actor }) => {
    await rejectDeposit(actor, id, reasonSchema.parse(reason ?? ""));
    return null;
  });
}

export async function reverseDepositAction(id: string, reason: string | null) {
  return adminAction("deposits.manage", async ({ actor }) => {
    await reauth();
    await reverseDeposit(actor, id, reasonSchema.parse(reason ?? ""));
    return null;
  });
}

export async function saveInternalNoteAction(kind: "deposit" | "withdrawal", id: string, note: string) {
  return adminAction(kind === "deposit" ? "deposits.manage" : "withdrawals.manage", async ({ actor }) => {
    const body = z.string().trim().max(2000).parse(note);
    await db.transaction(async (tx) => {
      const table = kind === "deposit" ? deposits : withdrawals;
      const [before] = await tx.select({ internalNote: table.internalNote }).from(table).where(eq(table.id, id)).for("update");
      if (!before) throw new AppError("Record not found");
      await tx.update(table).set({ internalNote: body || null, updatedAt: new Date() }).where(eq(table.id, id));
      await audit(tx, { actorId: actor.id, actorRole: actor.role, action: `${kind}.note`, entityType: kind, entityId: id, before, after: { internalNote: body } });
    });
    return null;
  });
}

/* -------------------------------- Withdrawals ------------------------------ */

export async function withdrawalAction(id: string, action: WithdrawalAction, note: string | null, payoutReference?: string) {
  return adminAction("withdrawals.manage", async ({ actor }) => {
    if (action === "reverse") await reauth();
    if (action === "complete" && !payoutReference?.trim()) throw new AppError("Enter the bank payout reference");
    await transitionWithdrawal(actor, id, action, { note: note?.trim() || undefined, payoutReference: payoutReference?.trim() });
    return null;
  });
}

/* ------------------------------ Ledger & recon ----------------------------- */

const adjustmentSchema = z.object({
  userId: z.string().min(1),
  account: z.enum(ADJUSTABLE_ACCOUNTS as [string, ...string[]]),
  direction: z.enum(["CREDIT", "DEBIT"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"),
  reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(300),
  note: z.string().trim().max(1000).default(""),
  idempotencyKey: z.string().min(8).max(100),
});

export async function createAdjustmentAction(input: z.input<typeof adjustmentSchema>) {
  return adminAction("ledger.adjust", async ({ actor }) => {
    await reauth();
    const parsed = adjustmentSchema.parse(input);
    const posted = await createAdjustment(actor, { ...parsed, account: parsed.account as (typeof ADJUSTABLE_ACCOUNTS)[number] });
    return { transactionId: posted.transactionId, replayed: posted.replayed };
  });
}

export async function runReconciliationAction(): Promise<ActionResult<ReconCheck[]>> {
  return adminAction("reconciliation.view", async ({ actor }) => {
    const checks = await runReconciliation();
    await audit(db, { actorId: actor.id, actorRole: actor.role, action: "reconciliation.run", entityType: "system", after: { failed: checks.filter((c) => !c.ok).map((c) => c.key) } });
    return checks;
  });
}

/* ----------------------------------- Users --------------------------------- */

export async function setSuspensionAction(userId: string, suspend: boolean, reason: string | null) {
  return adminAction("users.manage", async ({ actor }) => {
    await setSuspension(actor, userId, suspend, reasonSchema.parse(reason ?? ""));
    return null;
  });
}

export async function setVerificationAction(userId: string, input: { status?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED"; required?: boolean }, note: string | null) {
  return adminAction("users.manage", async ({ actor }) => {
    await setVerification(actor, userId, { ...input, note: note?.trim() || undefined });
    return null;
  });
}

export async function addUserNoteAction(userId: string, body: string) {
  return adminAction("users.manage", async ({ actor }) => {
    await addUserNote(actor, userId, z.string().trim().min(2).max(2000).parse(body));
    return null;
  });
}

export async function setRewardHoldAction(userId: string, onHold: boolean, reason: string | null) {
  return adminAction("risk.manage", async ({ actor }) => {
    await setUserRewardHold(actor, userId, onHold, reasonSchema.parse(reason ?? ""));
    return null;
  });
}

export async function sendUserNotificationAction(userId: string, input: { title: string; body: string; link?: string }) {
  return adminAction("notifications.manage", async ({ actor }) => {
    const v = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(1000), link: z.string().trim().max(200).optional() }).parse(input);
    await db.transaction(async (tx) => {
      await tx.insert(notifications).values({ userId, type: "SYSTEM", title: v.title, body: v.body, link: v.link || null });
      await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "notification.send", entityType: "profile", entityId: userId, after: v });
    });
    return null;
  });
}

/* ------------------------------ Admin management --------------------------- */

export async function setUserRoleAction(userId: string, role: string, reason: string | null) {
  return adminAction("admins.manage", async ({ actor }) => {
    await reauth();
    if (!ROLES.includes(role as Role)) throw new AppError("Unknown role");
    if (role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw new AppError("Only a Super Admin can grant Super Admin");
    await setUserRole(actor, userId, role as Role, reasonSchema.parse(reason ?? ""));
    return null;
  });
}

export async function setRolePermissionsAction(role: string, permissions: string[], reason: string | null) {
  return adminAction("admins.manage", async ({ actor }) => {
    await reauth();
    if (!ROLES.includes(role as Role)) throw new AppError("Unknown role");
    await setRolePermissions(actor, role as Role, permissions.filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission)), reasonSchema.parse(reason ?? ""));
    return null;
  });
}

export async function revokeSessionAction(sessionId: string, reason: string | null) {
  return adminAction("admins.manage", async ({ actor }) => {
    await reauth();
    const why = reasonSchema.parse(reason ?? "");
    await db.transaction(async (tx) => {
      const found = await tx.execute(sql`delete from neon_auth.session where id = ${sessionId} returning "userId" as user_id, "ipAddress" as ip, "createdAt" as created_at`);
      const row = Array.from(found)[0] as { user_id: string; ip: string | null; created_at: string } | undefined;
      if (!row) throw new AppError("Session not found or already ended");
      await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "session.revoke", entityType: "session", entityId: sessionId, before: row, after: null, reason: why });
    });
    revalidatePath("/admin/admins/sessions");
    return null;
  });
}

export async function findUserByEmailAction(email: string) {
  return adminAction("admins.manage", async () => {
    const [p] = await db.select({ id: profiles.id, name: profiles.name, role: profiles.role }).from(profiles).where(eq(profiles.email, email.trim().toLowerCase())).limit(1);
    if (!p) throw new AppError("No user with that email");
    return p;
  });
}

/* ------------------------------------ Risk --------------------------------- */

export async function updateRiskFlagAction(flagId: string, patch: { status?: "OPEN" | "IN_REVIEW" | "CLEARED" | "CONFIRMED"; assignToMe?: boolean; unassign?: boolean }, note: string | null) {
  return adminAction("risk.manage", async ({ actor }) => {
    await updateRiskFlag(actor, flagId, {
      status: patch.status,
      assignedToId: patch.assignToMe ? actor.id : patch.unassign ? null : undefined,
      note: note?.trim() || undefined,
    });
    return null;
  });
}

export async function createManualFlagAction(userId: string, input: { severity: "LOW" | "MEDIUM" | "HIGH"; summary: string }) {
  return adminAction("risk.manage", async ({ actor }) => {
    const summary = z.string().trim().min(5).max(300).parse(input.summary);
    await db.transaction(async (tx) => {
      const flag = await flagRisk(tx, { userId, type: "MANUAL", severity: input.severity, summary, details: { createdBy: actor.id } });
      await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "risk.manual_flag", entityType: "profile", entityId: userId, after: { severity: input.severity, summary, flagId: flag?.id } });
    });
    return null;
  });
}

export async function cashRewardAction(id: string, action: "hold" | "release" | "reverse", reason: string | null) {
  return adminAction("risk.manage", async ({ actor }) => {
    const r = reasonSchema.parse(reason ?? "");
    if (action === "hold") await holdCashReward(actor, id, r);
    if (action === "release") await releaseCashReward(actor, id, r);
    if (action === "reverse") {
      await reauth();
      await reverseCashReward(actor, id, r);
    }
    return null;
  });
}

/* ---------------------------------- Support -------------------------------- */

export async function staffReplyAction(ticketId: string, body: string, internal: boolean) {
  return adminAction("support.manage", async ({ actor }) => {
    await staffReply(actor, ticketId, z.string().trim().min(1).max(4000).parse(body), internal);
    return null;
  });
}

const ticketPatch = z.object({
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignToMe: z.boolean().optional(),
  unassign: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  resolution: z.string().trim().max(2000).optional(),
});

export async function updateTicketsAction(ids: string[], patch: z.input<typeof ticketPatch>) {
  return adminAction("support.manage", async ({ actor }) => {
    if (!ids.length) throw new AppError("Select at least one ticket");
    const p = ticketPatch.parse(patch);
    await updateTicket(actor, ids.slice(0, 200), {
      status: p.status,
      priority: p.priority,
      tags: p.tags,
      resolution: p.resolution,
      assignedToId: p.assignToMe ? actor.id : p.unassign ? null : undefined,
    });
    return null;
  });
}

/* ---------------------------------- System --------------------------------- */

export async function setFeatureFlagAction(key: string, enabled: boolean, reason: string | null) {
  return adminAction("system.manage", async ({ actor }) => {
    const r = reasonSchema.parse(reason ?? "");
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(featureFlags).where(eq(featureFlags.key, key)).for("update");
      if (!before) throw new AppError("Unknown flag");
      await tx.update(featureFlags).set({ enabled, updatedBy: actor.id, updatedAt: new Date() }).where(eq(featureFlags.key, key));
      await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "flag.update", entityType: "feature_flag", entityId: key, before: { enabled: before.enabled }, after: { enabled }, reason: r });
    });
    revalidatePath("/", "layout");
    return null;
  });
}

const ECONOMY_KEYS: ConfigKey[] = ["conversion", "deposit", "withdrawal", "rewards", "limits", "daily_defaults", "market"];
const REFERRAL_KEYS: ConfigKey[] = ["referral"];

function permissionForConfig(key: ConfigKey): Permission {
  if (ECONOMY_KEYS.includes(key)) return key === "daily_defaults" ? "daily.manage" : "economy.manage";
  if (REFERRAL_KEYS.includes(key)) return "referrals.manage";
  if (key === "risk") return "risk.manage";
  if (key === "prize_wheel") return "games.manage";
  return "system.manage";
}

export async function setConfigAction(key: string, value: unknown, reason: string | null) {
  if (!(key in CONFIG_DEFAULTS)) return { ok: false as const, error: "Unknown setting" };
  const k = key as ConfigKey;
  return adminAction(permissionForConfig(k), async ({ actor }) => {
    const r = reasonSchema.parse(reason ?? "");
    const def = CONFIG_DEFAULTS[k];
    if (typeof def !== typeof value || (typeof def === "object" && (value === null || Array.isArray(value) !== Array.isArray(def)))) {
      throw new AppError("The value has the wrong shape for this setting");
    }
    if (k === "conversion") {
      const v = value as { cash: string; credits: number };
      if (!/^\d+(\.\d{1,2})?$/.test(String(v.cash)) || Number(v.cash) <= 0 || !Number.isInteger(v.credits) || v.credits <= 0) {
        throw new AppError("Conversion needs a positive RM amount and a positive whole number of Credits");
      }
    }
    if (k === "market") {
      const v = value as { feePct: number; minPrice: number; maxPrice: number; maxActiveListings: number };
      const whole = (n: number) => Number.isInteger(n) && n >= 0;
      if (!whole(v.feePct) || v.feePct > 50 || !whole(v.minPrice) || v.minPrice < 1 || !whole(v.maxPrice) || v.maxPrice < v.minPrice || !whole(v.maxActiveListings) || v.maxActiveListings < 1) {
        throw new AppError("Market fee must be a whole percentage from 0 to 50%, prices whole Credits with max at least min, and at least 1 active listing");
      }
    }
    if (k === "prize_wheel") {
      const v = value as { active: boolean; prizeUnlockPct: number; alternativePct: number };
      if (!isValidPercentSplit([v.prizeUnlockPct, v.alternativePct])) {
        throw new AppError("Prize unlock and alternative reward chances must be whole percentages that total exactly 100%");
      }
    }
    await setConfig(k, value as never, actor, r);
    revalidatePath("/", "layout");
    return null;
  });
}

const CLAIM_STATUSES = ["UNDER_REVIEW", "APPROVED", "FULFILLING", "FULFILLED", "REJECTED"] as const;

export async function updatePrizeClaimStatusAction(claimId: string, status: string, note: string | null) {
  return adminAction("games.manage", async ({ actor }) => {
    const data = z
      .object({ claimId: z.string().uuid(), status: z.enum(CLAIM_STATUSES), note: z.string().trim().max(500) })
      .parse({ claimId, status, note: note ?? "" });
    if (data.status === "REJECTED" && data.note.length < 3) throw new AppError("Please give a reason for rejecting this claim");
    const result = await updatePrizeClaimStatus(actor, data);
    revalidatePath("/admin/games/prize-claims");
    return result;
  });
}

export async function runJobAction(job: string) {
  return adminAction("system.manage", async ({ actor }) => {
    if (!(job in JOBS)) throw new AppError("Unknown job");
    const result = await runJob(job as JobName, actor.id);
    await audit(db, { actorId: actor.id, actorRole: actor.role, action: "job.run", entityType: "job", entityId: job, after: result });
    if (!result.ok) throw new AppError(`Job failed: ${result.error}`);
    return result.result;
  });
}

export async function sendBroadcastNowAction(id: string) {
  return adminAction("notifications.manage", async ({ actor }) => {
    const count = await sendBroadcast(id);
    await audit(db, { actorId: actor.id, actorRole: actor.role, action: "broadcast.send", entityType: "broadcasts", entityId: id, after: { recipients: count } });
    if (!count) throw new AppError("Nothing sent. Make sure the broadcast is Published and has not been sent already.");
    return { count };
  });
}