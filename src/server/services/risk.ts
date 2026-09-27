import { and, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { deposits, loginEvents, profiles, riskFlags, riskNotes, withdrawalAccounts } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { toMinor } from "@/lib/money";
import { audit } from "./audit";
import { getConfig } from "./config";

export type RiskType = (typeof riskFlags.$inferInsert)["type"];
export type RiskSeverity = NonNullable<(typeof riskFlags.$inferInsert)["severity"]>;
export type RiskStatus = NonNullable<(typeof riskFlags.$inferInsert)["status"]>;

/** Records an operational risk signal. Signals are internal review prompts, never user-facing accusations. */
export async function flagRisk(
  tx: DbOrTx,
  input: { userId: string; relatedUserId?: string | null; type: RiskType; severity: RiskSeverity; summary: string; details?: Record<string, unknown> },
) {
  const [dupe] = await tx
    .select({ id: riskFlags.id })
    .from(riskFlags)
    .where(
      and(
        eq(riskFlags.userId, input.userId),
        eq(riskFlags.type, input.type),
        input.relatedUserId ? eq(riskFlags.relatedUserId, input.relatedUserId) : sql`${riskFlags.relatedUserId} is null`,
        inArray(riskFlags.status, ["OPEN", "IN_REVIEW"]),
      ),
    )
    .limit(1);
  if (dupe) return null;
  const [row] = await tx
    .insert(riskFlags)
    .values({
      userId: input.userId,
      relatedUserId: input.relatedUserId ?? null,
      type: input.type,
      severity: input.severity,
      summary: input.summary,
      details: input.details ?? {},
    })
    .returning();
  return row;
}

export async function onSignupSignals(tx: DbOrTx, profile: typeof profiles.$inferSelect) {
  const cfg = await getConfig("risk", tx);
  if (profile.referredById) {
    const [referrer] = await tx.select().from(profiles).where(eq(profiles.id, profile.referredById)).limit(1);
    if (referrer) {
      const sameDevice = profile.signupDeviceId && referrer.signupDeviceId === profile.signupDeviceId;
      const sameIp = profile.signupIp && referrer.signupIp === profile.signupIp;
      if (sameDevice || sameIp) {
        await flagRisk(tx, {
          userId: profile.id,
          relatedUserId: referrer.id,
          type: "SELF_REFERRAL",
          severity: sameDevice ? "HIGH" : "MEDIUM",
          summary: `Referred account shares ${sameDevice ? "a device" : "an IP address"} with its referrer`,
          details: { sameDevice: Boolean(sameDevice), sameIp: Boolean(sameIp) },
        });
      }
      const since = new Date(Date.now() - 86_400_000);
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(profiles)
        .where(and(eq(profiles.referredById, referrer.id), gte(profiles.createdAt, since)));
      if (n > cfg.rapidSignupPerIpPerDay * 3) {
        await flagRisk(tx, {
          userId: referrer.id,
          type: "REFERRAL_VELOCITY",
          severity: "MEDIUM",
          summary: `${n} referred sign-ups in the last 24 hours`,
          details: { count: n },
        });
      }
    }
  }
  if (profile.signupDeviceId) {
    const others = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.signupDeviceId, profile.signupDeviceId), ne(profiles.id, profile.id)))
      .limit(5);
    for (const o of others) {
      await flagRisk(tx, {
        userId: profile.id,
        relatedUserId: o.id,
        type: "DUPLICATE_ACCOUNT",
        severity: "MEDIUM",
        summary: "Account created from a device used by another account",
      });
    }
  }
  if (profile.signupIp) {
    const since = new Date(Date.now() - 86_400_000);
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(eq(profiles.signupIp, profile.signupIp), gte(profiles.createdAt, since)));
    if (n > cfg.rapidSignupPerIpPerDay) {
      await flagRisk(tx, {
        userId: profile.id,
        type: "RAPID_SIGNUP",
        severity: "LOW",
        summary: `${n} accounts created from the same IP address in 24 hours`,
        details: { ip: profile.signupIp, count: n },
      });
    }
  }
}

export async function onLoginSignals(tx: DbOrTx, userId: string, deviceId: string | null, ip: string | null) {
  if (deviceId) {
    const others = await tx
      .selectDistinct({ userId: loginEvents.userId })
      .from(loginEvents)
      .where(and(eq(loginEvents.deviceId, deviceId), eq(loginEvents.success, true), ne(loginEvents.userId, userId)))
      .limit(5);
    for (const o of others) {
      if (!o.userId) continue;
      await flagRisk(tx, { userId, relatedUserId: o.userId, type: "DEVICE_MATCH", severity: "LOW", summary: "Signed in from a device used by another account" });
    }
  }
  if (ip) {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const others = await tx
      .selectDistinct({ userId: loginEvents.userId })
      .from(loginEvents)
      .where(and(eq(loginEvents.ip, ip), eq(loginEvents.success, true), ne(loginEvents.userId, userId), gte(loginEvents.createdAt, since)))
      .limit(10);
    if (others.length >= 3) {
      await flagRisk(tx, { userId, type: "IP_MATCH", severity: "LOW", summary: `IP address shared with ${others.length} other accounts this week`, details: { ip } });
    }
  }
}

export async function onWithdrawalAccountSignals(tx: DbOrTx, userId: string, accountNumber: string) {
  const others = await tx
    .selectDistinct({ userId: withdrawalAccounts.userId })
    .from(withdrawalAccounts)
    .where(and(eq(withdrawalAccounts.accountNumber, accountNumber), ne(withdrawalAccounts.userId, userId)))
    .limit(5);
  for (const o of others) {
    await flagRisk(tx, {
      userId,
      relatedUserId: o.userId,
      type: "PAYMENT_METHOD_MATCH",
      severity: "HIGH",
      summary: "Withdrawal account number is also registered to another account",
    });
  }
}

export async function onDepositSignals(tx: DbOrTx, deposit: typeof deposits.$inferSelect) {
  const cfg = await getConfig("risk", tx);
  if (toMinor(deposit.amount) >= toMinor(cfg.largeDepositAmount)) {
    await flagRisk(tx, {
      userId: deposit.userId,
      type: "SUSPICIOUS_DEPOSIT",
      severity: "LOW",
      summary: `Large deposit of RM${deposit.amount}`,
      details: { depositId: deposit.id },
    });
  }
  const dupes = await tx
    .select({ userId: deposits.userId })
    .from(deposits)
    .where(and(eq(deposits.reference, deposit.reference), ne(deposits.userId, deposit.userId)))
    .limit(3);
  for (const d of dupes) {
    await flagRisk(tx, {
      userId: deposit.userId,
      relatedUserId: d.userId,
      type: "SUSPICIOUS_DEPOSIT",
      severity: "MEDIUM",
      summary: "Deposit reference matches another account's deposit",
      details: { depositId: deposit.id, reference: deposit.reference },
    });
  }
}

export async function hasOpenRisk(tx: DbOrTx, userId: string, severities: RiskSeverity[] = ["HIGH"]) {
  const [row] = await tx
    .select({ id: riskFlags.id })
    .from(riskFlags)
    .where(and(eq(riskFlags.userId, userId), inArray(riskFlags.status, ["OPEN", "IN_REVIEW"]), inArray(riskFlags.severity, severities)))
    .limit(1);
  return Boolean(row);
}

export async function linkedRisk(tx: DbOrTx, a: string, b: string) {
  const [row] = await tx
    .select({ id: riskFlags.id })
    .from(riskFlags)
    .where(
      and(
        inArray(riskFlags.status, ["OPEN", "IN_REVIEW"]),
        or(and(eq(riskFlags.userId, a), eq(riskFlags.relatedUserId, b)), and(eq(riskFlags.userId, b), eq(riskFlags.relatedUserId, a))),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function updateRiskFlag(
  actor: { id: string; role: string },
  flagId: string,
  patch: { status?: RiskStatus; assignedToId?: string | null; note?: string },
) {
  return db.transaction(async (tx) => {
    const [flag] = await tx.select().from(riskFlags).where(eq(riskFlags.id, flagId)).for("update");
    if (!flag) throw new NotFoundError("Risk flag not found");
    const next = {
      status: patch.status ?? flag.status,
      assignedToId: patch.assignedToId === undefined ? flag.assignedToId : patch.assignedToId,
      resolvedAt: patch.status && ["CLEARED", "CONFIRMED"].includes(patch.status) ? new Date() : flag.resolvedAt,
      updatedAt: new Date(),
    };
    await tx.update(riskFlags).set(next).where(eq(riskFlags.id, flagId));
    if (patch.note) await tx.insert(riskNotes).values({ flagId, authorId: actor.id, body: patch.note });
    await audit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "risk.update",
      entityType: "risk_flag",
      entityId: flagId,
      before: { status: flag.status, assignedToId: flag.assignedToId },
      after: { status: next.status, assignedToId: next.assignedToId },
      reason: patch.note ?? null,
    });
  });
}
