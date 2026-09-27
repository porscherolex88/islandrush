"use server";

import { eq, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import type { ResourceKey } from "@/lib/admin/resource-fields";
import { adminAction } from "@/lib/auth/session";
import { AppError, isUniqueViolation, type ActionResult } from "@/lib/errors";
import { loadResource, parseValues, pkValue } from "@/server/admin/resources";
import { audit } from "@/server/services/audit";

function isFkViolation(err: unknown) {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "23503") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

function requireReason(significant: boolean | undefined, reason: string | null) {
  if (significant && (!reason || reason.trim().length < 5)) throw new AppError("Please give a reason for this change (5+ characters)");
}

export async function saveResourceAction(key: string, id: string | null, raw: Record<string, unknown>, reason: string | null): Promise<ActionResult<{ id: string }>> {
  const r = loadResource(key);
  if (!r) return { ok: false, error: "Unknown resource" };
  const result = await adminAction(r.def.permission, async ({ actor }) => {
    requireReason(r.def.significant, reason);
    const values = parseValues(key as ResourceKey, r.def, raw, Boolean(id));
    try {
      const saved = await db.transaction(async (tx) => {
        if (!id) {
          const [row] = (await tx.insert(r.table).values(values).returning()) as Record<string, unknown>[];
          const newId = String(row[r.def.pk]);
          await audit(tx, { actorId: actor.id, actorRole: actor.role, action: `${key}.create`, entityType: key, entityId: newId, after: row, reason });
          return newId;
        }
        const where = eq(r.pkColumn, pkValue(r.def, id)) as SQL;
        const [before] = (await tx.select().from(r.table).where(where).for("update")) as Record<string, unknown>[];
        if (!before) throw new AppError("Record not found");
        const patch = "updatedAt" in r.columns ? { ...values, updatedAt: new Date() } : values;
        const [after] = (await tx.update(r.table).set(patch).where(where).returning()) as Record<string, unknown>[];
        const changed = Object.keys(values).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
        if (changed.length) {
          await audit(tx, {
            actorId: actor.id,
            actorRole: actor.role,
            action: `${key}.update`,
            entityType: key,
            entityId: id,
            before: Object.fromEntries(changed.map((k) => [k, before[k]])),
            after: Object.fromEntries(changed.map((k) => [k, after[k]])),
            reason,
          });
        }
        return id;
      });
      return { id: saved };
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError("Another record already uses this slug, key or position");
      if (isFkViolation(err)) throw new AppError("A linked record could not be found");
      throw err;
    }
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteResourceAction(key: string, id: string, reason: string | null): Promise<ActionResult<null>> {
  const r = loadResource(key);
  if (!r) return { ok: false, error: "Unknown resource" };
  const result = await adminAction(r.def.permission, async ({ actor }) => {
    if (!r.def.deletable) throw new AppError("This record cannot be deleted. Archive or deactivate it instead.");
    requireReason(r.def.significant, reason);
    try {
      await db.transaction(async (tx) => {
        const where = eq(r.pkColumn, pkValue(r.def, id)) as SQL;
        const [before] = (await tx.select().from(r.table).where(where).for("update")) as Record<string, unknown>[];
        if (!before) throw new AppError("Record not found");
        await tx.delete(r.table).where(where);
        await audit(tx, { actorId: actor.id, actorRole: actor.role, action: `${key}.delete`, entityType: key, entityId: id, before, reason });
      });
    } catch (err) {
      if (isFkViolation(err)) throw new AppError("This record is referenced by player history and cannot be deleted. Archive it instead.");
      throw err;
    }
    return null;
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
