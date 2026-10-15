import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminAccounts, adminSessions } from "@/db/schema";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import { audit } from "./audit";

export const ADMIN_SESSION_DAYS = 7;
export const ADMIN_LOCKOUT_ATTEMPTS = 5;
export const ADMIN_LOCKOUT_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

export type AdminAccount = typeof adminAccounts.$inferSelect;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashAdminPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

/** Creates the first admin from env when the table is empty. Never overwrites existing admins. */
export async function bootstrapAdminFromEnv(): Promise<{ created: boolean; username?: string }> {
  const [{ n }] = await db.select({ n: count() }).from(adminAccounts);
  if (n > 0) return { created: false };

  const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) return { created: false };
  if (password.length < 12) {
    console.warn("[admin-bootstrap] ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters; skipped.");
    return { created: false };
  }

  const passwordHash = await hashAdminPassword(password);
  const [row] = await db
    .insert(adminAccounts)
    .values({
      username: normalizeUsername(username),
      passwordHash,
      displayName: username.trim(),
      role: "SUPER_ADMIN",
      mustChangePassword: true,
    })
    .onConflictDoNothing()
    .returning({ username: adminAccounts.username });

  if (row) {
    await audit(db, {
      actorId: null,
      actorRole: "SYSTEM",
      action: "admin.bootstrap",
      entityType: "admin_account",
      entityId: null,
      after: { username: row.username, mustChangePassword: true },
      reason: "Created from ADMIN_BOOTSTRAP_* env (first admin)",
    });
    return { created: true, username: row.username };
  }
  return { created: false };
}

export async function createAdminAccount(input: {
  username: string;
  password: string;
  displayName: string;
  role: Exclude<Role, "USER">;
  mustChangePassword?: boolean;
  actorId?: string | null;
}) {
  if (input.password.length < 12) throw new AppError("Password must be at least 12 characters");
  const username = normalizeUsername(input.username);
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw new AppError("Username must be 3-40 characters: letters, numbers, . _ -");
  }
  const passwordHash = await hashAdminPassword(input.password);
  try {
    const [row] = await db
      .insert(adminAccounts)
      .values({
        username,
        passwordHash,
        displayName: input.displayName.trim() || username,
        role: input.role,
        mustChangePassword: input.mustChangePassword ?? false,
      })
      .returning();
    await audit(db, {
      actorId: input.actorId ?? null,
      actorRole: input.actorId ? "SUPER_ADMIN" : "SYSTEM",
      action: "admin.create",
      entityType: "admin_account",
      entityId: row.id,
      after: { username: row.username, role: row.role, mustChangePassword: row.mustChangePassword },
    });
    return row;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("admin_accounts_username")) {
      throw new AppError("That username is already taken");
    }
    throw err;
  }
}

export type AdminLoginResult =
  | { ok: true; admin: AdminAccount; token: string; expiresAt: Date }
  | { ok: false; error: string };

export async function loginAdmin(
  username: string,
  password: string,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<AdminLoginResult> {
  await bootstrapAdminFromEnv();
  const uname = normalizeUsername(username);
  const [admin] = await db.select().from(adminAccounts).where(eq(adminAccounts.username, uname)).limit(1);
  if (!admin) {
    await audit(db, {
      actorId: null,
      actorRole: "ANONYMOUS",
      action: "admin.login_failed",
      entityType: "admin_account",
      after: { username: uname },
      reason: "Unknown username",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, error: "Invalid username or password" };
  }

  if (admin.status !== "ACTIVE") {
    return { ok: false, error: "This admin account is suspended" };
  }
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    return { ok: false, error: "Account temporarily locked after too many failed attempts. Try again later." };
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    const attempts = admin.failedLoginAttempts + 1;
    const lockedUntil = attempts >= ADMIN_LOCKOUT_ATTEMPTS ? new Date(Date.now() + ADMIN_LOCKOUT_MINUTES * 60_000) : null;
    await db
      .update(adminAccounts)
      .set({
        failedLoginAttempts: lockedUntil ? 0 : attempts,
        lockedUntil,
        updatedAt: new Date(),
      })
      .where(eq(adminAccounts.id, admin.id));
    await audit(db, {
      actorId: admin.id,
      actorRole: admin.role,
      action: "admin.login_failed",
      entityType: "admin_account",
      entityId: admin.id,
      after: { attempts, locked: Boolean(lockedUntil) },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      ok: false,
      error: lockedUntil
        ? `Too many failed attempts. Account locked for ${ADMIN_LOCKOUT_MINUTES} minutes.`
        : "Invalid username or password",
    };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DAYS * 86_400_000);
  await db.insert(adminSessions).values({
    adminId: admin.id,
    tokenHash: hashToken(token),
    expiresAt,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });
  await db
    .update(adminAccounts)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminAccounts.id, admin.id));
  await audit(db, {
    actorId: admin.id,
    actorRole: admin.role,
    action: "admin.login",
    entityType: "admin_account",
    entityId: admin.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { ok: true, admin, token, expiresAt };
}

export async function resolveAdminSession(token: string | null): Promise<{ admin: AdminAccount; sessionId: string; createdAt: Date } | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({
      sessionId: adminSessions.id,
      createdAt: adminSessions.createdAt,
      expiresAt: adminSessions.expiresAt,
      revokedAt: adminSessions.revokedAt,
      admin: adminAccounts,
    })
    .from(adminSessions)
    .innerJoin(adminAccounts, eq(adminAccounts.id, adminSessions.adminId))
    .where(and(eq(adminSessions.tokenHash, tokenHash), isNull(adminSessions.revokedAt), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.admin.status !== "ACTIVE") return null;
  return { admin: row.admin, sessionId: row.sessionId, createdAt: row.createdAt };
}

export async function revokeAdminSessionToken(token: string) {
  await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.tokenHash, hashToken(token)));
}

export async function changeAdminPassword(adminId: string, currentPassword: string, newPassword: string) {
  if (newPassword.length < 12) throw new AppError("New password must be at least 12 characters");
  return db.transaction(async (tx) => {
    const [admin] = await tx.select().from(adminAccounts).where(eq(adminAccounts.id, adminId)).for("update");
    if (!admin) throw new ForbiddenError();
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw new AppError("Current password is incorrect");
    }
    const passwordHash = await hashAdminPassword(newPassword);
    await tx
      .update(adminAccounts)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(adminAccounts.id, adminId));
    await audit(tx, {
      actorId: adminId,
      actorRole: admin.role,
      action: "admin.password_change",
      entityType: "admin_account",
      entityId: adminId,
      after: { mustChangePassword: false },
    });
  });
}

export async function revokeAdminSession(sessionId: string, actorId: string) {
  await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.id, sessionId));
  await audit(db, {
    actorId,
    actorRole: "SUPER_ADMIN",
    action: "admin.session_revoke",
    entityType: "admin_session",
    entityId: sessionId,
  });
}

export async function listAdminSessions(adminId?: string) {
  const q = db
    .select({
      id: adminSessions.id,
      adminId: adminSessions.adminId,
      username: adminAccounts.username,
      displayName: adminAccounts.displayName,
      createdAt: adminSessions.createdAt,
      expiresAt: adminSessions.expiresAt,
      revokedAt: adminSessions.revokedAt,
      ip: adminSessions.ip,
      userAgent: adminSessions.userAgent,
    })
    .from(adminSessions)
    .innerJoin(adminAccounts, eq(adminAccounts.id, adminSessions.adminId));
  if (adminId) return q.where(eq(adminSessions.adminId, adminId));
  return q;
}
