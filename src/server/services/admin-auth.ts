import "server-only";
import { cookies } from "next/headers";
import { db } from "@/db";
import { audit } from "./audit";
import { resolveAdminSession, revokeAdminSessionToken } from "./admin-auth-core";

export const ADMIN_SESSION_COOKIE = "lb_admin_session";

export {
  ADMIN_LOCKOUT_ATTEMPTS,
  ADMIN_LOCKOUT_MINUTES,
  ADMIN_SESSION_DAYS,
  bootstrapAdminFromEnv,
  changeAdminPassword,
  createAdminAccount,
  hashAdminPassword,
  listAdminSessions,
  loginAdmin,
  resolveAdminSession,
  revokeAdminSession,
  type AdminAccount,
  type AdminLoginResult,
} from "./admin-auth-core";

export async function setAdminSessionCookie(token: string, expiresAt: Date) {
  const c = await cookies();
  c.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearAdminSessionCookie() {
  const c = await cookies();
  c.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSessionToken() {
  const c = await cookies();
  return c.get(ADMIN_SESSION_COOKIE)?.value ?? null;
}

export async function logoutAdmin(token: string | null, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  if (!token) {
    await clearAdminSessionCookie();
    return;
  }
  const session = await resolveAdminSession(token);
  await revokeAdminSessionToken(token);
  if (session) {
    await audit(db, {
      actorId: session.admin.id,
      actorRole: session.admin.role,
      action: "admin.logout",
      entityType: "admin_account",
      entityId: session.admin.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
  await clearAdminSessionCookie();
}
