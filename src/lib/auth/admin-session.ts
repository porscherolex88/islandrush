import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { ForbiddenError, toActionError, type ActionResult } from "@/lib/errors";
import type { Permission, Role } from "@/lib/permissions";
import {
  bootstrapAdminFromEnv,
  getAdminSessionToken,
  resolveAdminSession,
  type AdminAccount,
} from "@/server/services/admin-auth";
import { permissionsForRole } from "@/server/services/permissions";
import { getConfig } from "@/server/services/config";

/** Compatible shape used across existing admin UI (name/email display fields). */
export type AdminUserView = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AdminAccount["status"];
  mustChangePassword: boolean;
};

export type AdminContext = {
  user: AdminUserView;
  admin: AdminAccount;
  role: Role;
  permissions: Set<Permission>;
  can: (p: Permission) => boolean;
  sessionCreatedAt: Date;
};

function toView(admin: AdminAccount): AdminUserView {
  return {
    id: admin.id,
    name: admin.displayName,
    email: admin.username,
    role: admin.role as Role,
    status: admin.status,
    mustChangePassword: admin.mustChangePassword,
  };
}

export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  await bootstrapAdminFromEnv();
  const token = await getAdminSessionToken();
  const session = await resolveAdminSession(token);
  if (!session) return null;
  const role = session.admin.role as Role;
  if (role === "USER") return null;
  const permissions = await permissionsForRole(role);
  return {
    user: toView(session.admin),
    admin: session.admin,
    role,
    permissions,
    can: (p) => permissions.has(p),
    sessionCreatedAt: session.createdAt,
  };
});

/** Server-side guard for admin pages. Unauthenticated staff go to /admin/login. */
export async function requireAdmin(permission?: Permission): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (ctx.admin.mustChangePassword) redirect("/admin/change-password");
  if (permission && !ctx.can(permission)) redirect("/admin/forbidden");
  return ctx;
}

/** Like requireAdmin but allows the forced password-change page. */
export async function requireAdminAllowPasswordChange(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  return ctx;
}

export async function adminAction<T>(
  permission: Permission,
  fn: (ctx: AdminContext & { actor: { id: string; role: Role } }) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const ctx = await getAdminContext();
    if (!ctx) throw new ForbiddenError();
    if (ctx.admin.mustChangePassword) throw new ForbiddenError("Change your password before continuing");
    if (!ctx.can(permission)) throw new ForbiddenError();
    return { ok: true, data: await fn({ ...ctx, actor: { id: ctx.user.id, role: ctx.role } }) };
  } catch (err) {
    return toActionError(err);
  }
}

/** Step-up check: admin session must have been created recently. */
export async function assertRecentAuth(maxMinutes?: number) {
  const cfg = await getConfig("admin_security");
  const minutes = maxMinutes ?? cfg.reauthMinutes;
  const ctx = await getAdminContext();
  if (!ctx || Date.now() - ctx.sessionCreatedAt.getTime() > minutes * 60_000) {
    const { AppError } = await import("@/lib/errors");
    throw new AppError("For security, please sign out and sign in again before performing this action.", "REAUTH_REQUIRED", 401);
  }
}

export function adminNotFound() {
  notFound();
}
