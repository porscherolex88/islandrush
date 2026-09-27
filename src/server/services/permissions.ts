import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { profiles, rolePermissions } from "@/db/schema";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type Permission, type Role } from "@/lib/permissions";
import { audit } from "./audit";

/** Resolves a role's permissions from the database, falling back to defaults. SUPER_ADMIN always has everything. */
export async function permissionsForRole(role: Role, tx: DbOrTx = db): Promise<Set<Permission>> {
  if (role === "SUPER_ADMIN") return new Set(ALL_PERMISSIONS);
  if (role === "USER") return new Set();
  const rows = await tx.select().from(rolePermissions).where(eq(rolePermissions.role, role));
  if (rows.length === 0) return new Set(DEFAULT_ROLE_PERMISSIONS[role]);
  return new Set(rows.map((r) => r.permission as Permission).filter((p) => ALL_PERMISSIONS.includes(p)));
}

export async function hasPermission(role: Role, permission: Permission, tx: DbOrTx = db) {
  return (await permissionsForRole(role, tx)).has(permission);
}

export async function assertPermission(role: Role, permission: Permission, tx: DbOrTx = db) {
  if (!(await hasPermission(role, permission, tx))) throw new ForbiddenError();
}

export async function setRolePermissions(actor: { id: string; role: Role }, role: Role, permissions: Permission[], reason: string) {
  if (role === "SUPER_ADMIN" || role === "USER") throw new AppError("This role's permissions are fixed");
  const clean = [...new Set(permissions.filter((p) => ALL_PERMISSIONS.includes(p)))];
  await db.transaction(async (tx) => {
    const before = [...(await permissionsForRole(role, tx))];
    await tx.delete(rolePermissions).where(eq(rolePermissions.role, role));
    if (clean.length) await tx.insert(rolePermissions).values(clean.map((permission) => ({ role, permission })));
    // A role with zero permissions is stored as a sentinel so it does not fall back to defaults.
    if (!clean.length) await tx.insert(rolePermissions).values({ role, permission: "__none__" });
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "permissions.update", entityType: "role", entityId: role, before, after: clean, reason });
  });
}

export async function setUserRole(actor: { id: string; role: Role }, userId: string, role: Role, reason: string) {
  if (actor.id === userId) throw new AppError("You cannot change your own role");
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw new NotFoundError("User not found");
    await tx.update(profiles).set({ role, updatedAt: new Date() }).where(eq(profiles.id, userId));
    await audit(tx, { actorId: actor.id, actorRole: actor.role, action: "user.role_change", entityType: "profile", entityId: userId, before: { role: p.role }, after: { role }, reason });
  });
}
