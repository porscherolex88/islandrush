import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginEvents, profiles, userNotes, userStreaks } from "@/db/schema";
import { AppError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { randomCode } from "@/lib/rng";
import { audit } from "./audit";
import { recomputeDepositLevel } from "./deposit-levels";
import { ensureUserAccounts } from "./ledger";
import { notify } from "./notifications";
import { onLoginSignals, onSignupSignals } from "./risk";

export type Profile = typeof profiles.$inferSelect;
type Actor = { id: string; role: string };

/** Creates the application profile for a Neon Auth user on first sight. Idempotent. */
export async function ensureProfile(
  authUser: { id: string; email: string; name?: string | null },
  ctx: { ip?: string | null; deviceId?: string | null; referralCode?: string | null } = {},
): Promise<Profile> {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, authUser.id)).limit(1);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        let referredById: string | null = null;
        if (ctx.referralCode) {
          const [ref] = await tx
            .select({ id: profiles.id })
            .from(profiles)
            .where(eq(profiles.referralCode, ctx.referralCode.toUpperCase()))
            .limit(1);
          if (ref && ref.id !== authUser.id) referredById = ref.id;
        }
        const [profile] = await tx
          .insert(profiles)
          .values({
            id: authUser.id,
            email: authUser.email.toLowerCase(),
            name: authUser.name?.trim() || authUser.email.split("@")[0],
            referralCode: randomCode(8),
            referredById,
            signupIp: ctx.ip ?? null,
            signupDeviceId: ctx.deviceId ?? null,
          })
          .returning();
        await ensureUserAccounts(tx, profile.id);
        await tx.insert(userStreaks).values({ userId: profile.id }).onConflictDoNothing();
        await recomputeDepositLevel(tx, profile.id);
        await notify(tx, profile.id, "SYSTEM", "Welcome to LootBox 🏝️", "Your island adventure starts now. Claim your daily check-in and spin to get going.", "/app/daily");
        if (referredById) {
          await notify(tx, referredById, "REFERRAL", "New referral joined", `${profile.name.split(" ")[0]} joined with your referral code.`, "/app/referrals");
        }
        await onSignupSignals(tx, profile);
        const [fresh] = await tx.select().from(profiles).where(eq(profiles.id, profile.id)).limit(1);
        return fresh;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const [row] = await db.select().from(profiles).where(eq(profiles.id, authUser.id)).limit(1);
      if (row) return row;
    }
  }
  throw new AppError("Could not create your profile. Please try again.");
}

export async function recordLogin(input: { userId: string | null; email: string; success: boolean; ip: string | null; userAgent: string | null; deviceId: string | null }) {
  await db.insert(loginEvents).values(input);
  if (input.success && input.userId) {
    await db.update(profiles).set({ lastSeenAt: new Date() }).where(eq(profiles.id, input.userId));
    await onLoginSignals(db, input.userId, input.deviceId, input.ip);
  }
}

export async function touchLastSeen(userId: string) {
  await db
    .update(profiles)
    .set({ lastSeenAt: new Date() })
    .where(sql`${profiles.id} = ${userId} and (${profiles.lastSeenAt} is null or ${profiles.lastSeenAt} < now() - interval '5 minutes')`);
}

export async function updateOwnProfile(userId: string, patch: { name?: string; phone?: string | null }) {
  await db.update(profiles).set({ ...patch, updatedAt: new Date() }).where(eq(profiles.id, userId));
}

export async function updateNotificationPrefs(userId: string, prefs: Profile["notificationPrefs"]) {
  await db.update(profiles).set({ notificationPrefs: prefs, updatedAt: new Date() }).where(eq(profiles.id, userId));
}

export async function updatePlayLimits(userId: string, limits: Profile["playLimits"]) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw new NotFoundError();
    // Self-exclusion can be extended but not shortened by the user.
    const current = p.playLimits?.selfExcludedUntil ? new Date(p.playLimits.selfExcludedUntil) : null;
    const requested = limits.selfExcludedUntil ? new Date(limits.selfExcludedUntil) : null;
    if (current && current > new Date() && (!requested || requested < current)) {
      throw new AppError("An active play break can't be shortened. Contact support if you need help.");
    }
    await tx.update(profiles).set({ playLimits: limits, updatedAt: new Date() }).where(eq(profiles.id, userId));
    await audit(tx, { actorId: userId, actorRole: "USER", action: "user.play_limits", entityType: "profile", entityId: userId, before: p.playLimits, after: limits });
  });
}

export async function requestVerification(userId: string) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw new NotFoundError();
    if (p.verificationStatus === "VERIFIED") throw new AppError("Your account is already verified");
    if (p.verificationStatus === "PENDING") throw new AppError("Your verification is already under review");
    if (!p.phone) throw new AppError("Add a phone number to your profile before requesting verification");
    await tx.update(profiles).set({ verificationStatus: "PENDING", updatedAt: new Date() }).where(eq(profiles.id, userId));
  });
}

/* ------------------------------ Admin actions ------------------------------ */

export async function setSuspension(actor: Actor, userId: string, suspend: boolean, reason: string) {
  if (actor.id === userId) throw new AppError("You cannot suspend your own account");
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw new NotFoundError("User not found");
    await tx
      .update(profiles)
      .set({ status: suspend ? "SUSPENDED" : "ACTIVE", suspendedReason: suspend ? reason : null, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: suspend ? "user.suspend" : "user.unsuspend", entityType: "profile", entityId: userId, before: { status: p.status }, after: { status: suspend ? "SUSPENDED" : "ACTIVE" }, reason });
    await notify(tx, userId, "SYSTEM", suspend ? "Account restricted" : "Account restored", suspend ? "Your account has been restricted. Please contact support for details." : "Your account is active again.", "/app/account/support");
  });
}

export async function setVerification(
  actor: Actor,
  userId: string,
  input: { status?: Profile["verificationStatus"]; required?: boolean; note?: string },
) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw new NotFoundError("User not found");
    const next = {
      verificationStatus: input.status ?? p.verificationStatus,
      verificationRequired: input.required ?? p.verificationRequired,
      verificationNote: input.note ?? p.verificationNote,
      updatedAt: new Date(),
    };
    await tx.update(profiles).set(next).where(eq(profiles.id, userId));
    await audit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "user.verification",
      entityType: "profile",
      entityId: userId,
      before: { verificationStatus: p.verificationStatus, verificationRequired: p.verificationRequired },
      after: { verificationStatus: next.verificationStatus, verificationRequired: next.verificationRequired },
      reason: input.note ?? null,
    });
    if (input.status && input.status !== p.verificationStatus) {
      await notify(tx, userId, "SYSTEM", "Verification update", `Your verification status is now ${input.status.toLowerCase()}.`, "/app/account/verification");
    }
  });
}

export async function addUserNote(actor: Actor, userId: string, body: string) {
  await db.transaction(async (tx) => {
    await tx.insert(userNotes).values({ userId, authorId: actor.id, body });
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "user.note", entityType: "profile", entityId: userId, after: { body } });
  });
}
