import { asc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { depositLevels, profiles } from "@/db/schema";
import { toMinor } from "@/lib/money";
import { notify } from "./notifications";

export async function listDepositLevels(tx: DbOrTx = db) {
  return tx.select().from(depositLevels).orderBy(asc(depositLevels.sortOrder));
}

export function levelForTotal(levels: (typeof depositLevels.$inferSelect)[], total: string) {
  const t = toMinor(total);
  let current = levels[0] ?? null;
  for (const l of levels) if (toMinor(l.threshold) <= t) current = l;
  return current;
}

/** Recomputes Deposit Level from qualifying cumulative deposits. Deposit Level is independent of XP Level. */
export async function recomputeDepositLevel(tx: DbOrTx, userId: string) {
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile) return null;
  const levels = await listDepositLevels(tx);
  const level = levelForTotal(levels, profile.totalDeposits);
  if (level && level.id !== profile.depositLevelId) {
    const previous = levels.find((l) => l.id === profile.depositLevelId);
    await tx.update(profiles).set({ depositLevelId: level.id, updatedAt: new Date() }).where(eq(profiles.id, userId));
    if (!previous || previous.sortOrder < level.sortOrder) {
      await notify(tx, userId, "WALLET", `Deposit Level: ${level.name}`, `You've reached ${level.name}. See your new benefits in Progress.`, "/app/progress");
    }
  }
  return level;
}

export async function depositLevelProgress(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  const levels = await listDepositLevels();
  const current = levelForTotal(levels, profile?.totalDeposits ?? "0");
  const next = levels.find((l) => current && l.sortOrder > current.sortOrder) ?? null;
  const total = toMinor(profile?.totalDeposits ?? "0");
  const floor = current ? toMinor(current.threshold) : 0n;
  const ceil = next ? toMinor(next.threshold) : floor;
  const pct = next ? Number(((total - floor) * 100n) / (ceil - floor || 1n)) : 100;
  return { levels, current, next, total: profile?.totalDeposits ?? "0", pct: Math.max(0, Math.min(100, pct)), toNext: next ? ceil - total : 0n };
}
