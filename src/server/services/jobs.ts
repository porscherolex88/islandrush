import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { broadcasts, jobRuns, rateLimits } from "@/db/schema";
import { runReconciliation } from "./admin-finance";
import { settleDueRewards } from "./cash-rewards";
import { pollUsdtDeposits } from "./usdt-deposits";

export const JOBS = {
  "settle-rewards": { label: "Settle due rewards", description: "Moves eligible Pending Rewards into Withdrawable." },
  "send-broadcasts": { label: "Send scheduled broadcasts", description: "Delivers published broadcasts whose send time has passed." },
  reconcile: { label: "Reconciliation", description: "Runs ledger integrity checks." },
  "cleanup-rate-limits": { label: "Clean up rate limits", description: "Removes expired rate-limit windows." },
  "poll-usdt-deposits": {
    label: "Poll USDT TRC20 deposits",
    description: "Matches TronGrid transfers to pending unique amounts and credits after confirmations.",
  },
} as const;
export type JobName = keyof typeof JOBS;

/** Sends a broadcast as in-app notifications with a single set-based insert. */
export async function sendBroadcast(id: string) {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(broadcasts).where(eq(broadcasts.id, id)).for("update");
    if (!b || b.sentAt || b.status !== "PUBLISHED") return 0;
    const audienceFilter =
      b.audience === "DEPOSITORS" ? sql`and p.total_deposits > 0` : b.audience === "NON_DEPOSITORS" ? sql`and p.total_deposits = 0` : sql``;
    const result = await tx.execute(sql`
      insert into notifications (user_id, type, title, body, link, broadcast_id)
      select p.id, 'SYSTEM', ${b.title}, ${b.body}, ${b.link}, ${b.id}
      from profiles p where p.status = 'ACTIVE' ${audienceFilter}`);
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    await tx.update(broadcasts).set({ sentAt: new Date(), recipientCount: count, updatedAt: new Date() }).where(eq(broadcasts.id, id));
    return count;
  });
}

async function execute(job: JobName): Promise<Record<string, unknown>> {
  switch (job) {
    case "settle-rewards":
      return settleDueRewards();
    case "send-broadcasts": {
      const due = await db
        .select({ id: broadcasts.id })
        .from(broadcasts)
        .where(and(eq(broadcasts.status, "PUBLISHED"), isNull(broadcasts.sentAt), or(isNull(broadcasts.scheduledAt), lte(broadcasts.scheduledAt, new Date()))));
      let recipients = 0;
      for (const b of due) recipients += await sendBroadcast(b.id);
      return { broadcasts: due.length, recipients };
    }
    case "reconcile": {
      const checks = await runReconciliation();
      return { passed: checks.filter((c) => c.ok).length, failed: checks.filter((c) => !c.ok).map((c) => c.key) };
    }
    case "cleanup-rate-limits": {
      const deleted = await db.delete(rateLimits).where(lte(rateLimits.resetAt, new Date())).returning({ key: rateLimits.key });
      return { deleted: deleted.length };
    }
    case "poll-usdt-deposits":
      return pollUsdtDeposits();
  }
}

export async function runJob(job: JobName, triggeredBy: string) {
  const [run] = await db.insert(jobRuns).values({ job, triggeredBy }).returning();
  try {
    const result = await execute(job);
    await db.update(jobRuns).set({ status: "SUCCESS", result, finishedAt: new Date() }).where(eq(jobRuns.id, run.id));
    return { ok: true as const, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(jobRuns).set({ status: "FAILED", error: message, finishedAt: new Date() }).where(eq(jobRuns.id, run.id));
    return { ok: false as const, error: message };
  }
}
