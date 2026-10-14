import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { AppError, ForbiddenError, toActionError, type ActionResult } from "@/lib/errors";
import { isAdminRole, type Permission, type Role } from "@/lib/permissions";
import { permissionsForRole } from "@/server/services/permissions";
import { ensureProfile, touchLastSeen, type Profile } from "@/server/services/profiles";
import { getRequestMeta } from "./request";
import { getAuth } from "./server";

export type AuthSession = { user: { id: string; email: string; name: string }; session: { id: string; createdAt: Date | string } };

/** The Neon Auth session from cookies. */
export const getAuthSession = cache(async (): Promise<AuthSession | null> => {
  try {
    const { data } = await getAuth().getSession();
    if (!data?.user) return null;
    return data as unknown as AuthSession;
  } catch {
    return null;
  }
});

/** Returns the signed-in user's LootBox profile, creating it on first sight. */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const session = await getAuthSession();
  if (!session) return null;
  const meta = await getRequestMeta();
  const profile = await ensureProfile(
    { id: session.user.id, email: session.user.email, name: session.user.name },
    { ip: meta.ip, deviceId: meta.deviceId, referralCode: meta.referralCode },
  );
  void touchLastSeen(profile.id).catch(() => {});
  return profile;
});

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type AdminContext = { user: Profile; role: Role; permissions: Set<Permission>; can: (p: Permission) => boolean };

export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role) || user.status !== "ACTIVE") return null;
  const permissions = await permissionsForRole(user.role as Role);
  return { user, role: user.role as Role, permissions, can: (p) => permissions.has(p) };
});

/** Server-side guard for admin pages. Non-admins get a 404 so the console is not discoverable. */
export async function requireAdmin(permission?: Permission): Promise<AdminContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const ctx = await getAdminContext();
  if (!ctx) notFound();
  if (permission && !ctx.can(permission)) redirect("/admin/forbidden");
  return ctx;
}

/** Wraps a user server action with authentication, account-state checks and safe error handling. */
export async function userAction<T>(fn: (user: Profile) => Promise<T>, opts: { allowSuspended?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Please sign in again", "UNAUTHENTICATED", 401);
    if (!opts.allowSuspended && user.status !== "ACTIVE") throw new ForbiddenError("Your account is suspended. Please contact support.");
    return { ok: true, data: await fn(user) };
  } catch (err) {
    return toActionError(err);
  }
}

/** Wraps an admin server action with RBAC. Permission is always checked server-side. */
export async function adminAction<T>(permission: Permission, fn: (ctx: AdminContext & { actor: { id: string; role: Role } }) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const ctx = await getAdminContext();
    if (!ctx) throw new ForbiddenError();
    if (!ctx.can(permission)) throw new ForbiddenError();
    return { ok: true, data: await fn({ ...ctx, actor: { id: ctx.user.id, role: ctx.role } }) };
  } catch (err) {
    return toActionError(err);
  }
}

/** Step-up check for high-risk admin actions: the admin session must be recent. */
export async function assertRecentAuth(maxMinutes: number) {
  const session = await getAuthSession();
  const created = session?.session?.createdAt ? new Date(session.session.createdAt) : null;
  if (!created || Date.now() - created.getTime() > maxMinutes * 60_000) {
    throw new AppError("For security, please sign out and sign in again before performing this action.", "REAUTH_REQUIRED", 401);
  }
}
