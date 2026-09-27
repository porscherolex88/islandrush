import { auditLogs } from "@/db/schema";
import type { DbOrTx } from "@/db";

export type AuditInput = {
  actorId: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

function sanitize(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v instanceof Buffer ? "[binary]" : v)),
  );
}

/** Appends an immutable audit record. Audit rows are protected from UPDATE/DELETE by a database trigger. */
export async function audit(tx: DbOrTx, input: AuditInput) {
  await tx.insert(auditLogs).values({
    actorId: input.actorId,
    actorRole: input.actorRole ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: sanitize(input.before) as object | null,
    after: sanitize(input.after) as object | null,
    reason: input.reason ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
}
