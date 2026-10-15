import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginEvents, profiles, userNotes, userStreaks } from "@/db/schema";
import { AppError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { looksLikeEmail, normalizeMyPhone, phoneAuthEmail } from "@/lib/phone";
import { randomCode } from "@/lib/rng";
import { audit } from "./audit";
import { recomputeDepositLevel } from "./deposit-levels";
import { ensureUserAccounts } from "./ledger";
import { notify } from "./notifications";
import { onLoginSignals, onSignupSignals } from "./risk";

export type Profile = typeof profiles.$inferSelect;
type Actor = { id: string; role: string };

/** Look up a profile by phone (E.164 or local form) or by email (legacy accounts). */
export async function findProfileByLogin(identifier: string): Promise<Profile | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (looksLikeEmail(trimmed)) {
    const [row] = await db.select().from(profiles).where(eq(profiles.email, trimmed.toLowerCase())).limit(1);
    return row ?? null;
  }
  const phone = normalizeMyPhone(trimmed);
  if (!phone) return null;
  const [byPhone] = await db.select().from(profiles).where(eq(profiles.phone, phone)).limit(1);
  if (byPhone) return byPhone;
  const [bySynth] = await db.select().from(profiles).where(eq(profiles.email, phoneAuthEmail(phone))).limit(1);
  return bySynth ?? null;
}

/** Creates the application profile for a Neon Auth user on first sight. Idempotent. */
export async function ensureProfile(
  authUser: { id: string; email: string; name?: string | null },
  ctx: {
    ip?: string | null;
    deviceId?: string | null;
    referralCode?: string | null;
    phone?: string | null;
    dateOfBirth?: string | null;
    country?: string | null;
  } = {},
): Promise<Profile> {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, authUser.id)).limit(1);
  if (existing) {
    // Backfill phone / DOB when a returning session provides them (e.g. phone login of a new account).
    const patch: Partial<Profile> = {};
    if (ctx.phone && !existing.phone) patch.phone = ctx.phone;
    if (ctx.dateOfBirth && !existing.dateOfBirth) patch.dateOfBirth = ctx.dateOfBirth;
    if (Object.keys(patch).length) {
      const [updated] = await db.update(profiles).set({ ...patch, updatedAt: new Date() }).where(eq(profiles.id, existing.id)).returning();
      return updated;
    }
    return existing;
  }

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
        const country = ctx.country?.trim().toUpperCase() || null;
        const [profile] = await tx
          .insert(profiles)
          .values({
            id: authUser.id,
            email: authUser.email.toLowerCase(),
            name: authUser.name?.trim() || authUser.email.split("@")[0],
            phone: ctx.phone ?? null,
            dateOfBirth: ctx.dateOfBirth ?? null,
            referralCode: randomCode(8),
            referredById,
            signupIp: ctx.ip ?? null,
            signupDeviceId: ctx.deviceId ?? null,
            signupCountry: country && /^[A-Z]{2}$/.test(country) ? country : null,
          })
          .returning();
        await ensureUserAccounts(tx, profile.id);
        await tx.insert(userStreaks).values({ userId: profile.id }).onConflictDoNothing();
        await recomputeDepositLevel(tx, profile.id);
        await notify(tx, profile.id, "SYSTEM", "Welcome to LootBox 🏝️", "Your island adventure starts now. Claim your daily check-in and spin to get going.", "/daily");
        if (referredById) {
          await notify(tx, referredById, "REFERRAL", "New referral joined", `${profile.name.split(" ")[0]} joined with your referral code.`, "/invite");
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
  if (patch.phone) {
    const [taken] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.phone, patch.phone), ne(profiles.id, userId)))
      .limit(1);
    if (taken) throw new AppError("That phone number is already on another account");
  }
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

export async function requestVerification(
  userId: string,
  docs?: { idDocumentFileId: string; addressProofFileId: string },
) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw new NotFoundError();
    if (p.verificationStatus === "VERIFIED") throw new AppError("Your account is already verified");
    if (p.verificationStatus === "PENDING") throw new AppError("Your verification is already under review");
    if (!docs?.idDocumentFileId || !docs?.addressProofFileId) {
      throw new AppError("Upload a photo of your ID and a proof of address");
    }
    await tx
      .update(profiles)
      .set({
        verificationStatus: "PENDING",
        verificationRequired: true,
        idDocumentFileId: docs.idDocumentFileId,
        addressProofFileId: docs.addressProofFileId,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));
    await audit(tx, {
      actorId: userId,
      actorRole: "USER",
      action: "user.verification_submit",
      entityType: "profile",
      entityId: userId,
      after: { verificationStatus: "PENDING", idDocumentFileId: docs.idDocumentFileId, addressProofFileId: docs.addressProofFileId },
    });
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
    await notify(tx, userId, "SYSTEM", suspend ? "Account restricted" : "Account restored", suspend ? "Your account has been restricted. Please contact support for details." : "Your account is active again.", "/account/support");
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
      await notify(tx, userId, "SYSTEM", "Verification update", `Your verification status is now ${input.status.toLowerCase()}.`, "/account/verification");
    }
  });
}

export async function addUserNote(actor: Actor, userId: string, body: string) {
  await db.transaction(async (tx) => {
    await tx.insert(userNotes).values({ userId, authorId: actor.id, body });
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "user.note", entityType: "profile", entityId: userId, after: { body } });
  });
}
