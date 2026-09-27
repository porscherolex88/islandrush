import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { profiles, xpLevels, xpRules, xpTransactions } from "@/db/schema";
import { checkAchievements } from "./achievements";
import { notify } from "./notifications";
import { grantPool } from "./rewards";

export const XP_SOURCES = [
  "DAILY_LOGIN",
  "DAILY_SPIN",
  "BOX_OPEN",
  "TILE_DISCOVER",
  "AREA_UNLOCK",
  "MISSION_COMPLETE",
  "MISSIONS_ALL",
  "STREAK_MILESTONE",
  "COLLECTION_COMPLETE",
  "VAULT_UNLOCK",
  "DAILY_EVENT",
] as const;

export async function xpForRule(tx: Tx, source: string): Promise<number> {
  const [rule] = await tx.select().from(xpRules).where(eq(xpRules.source, source)).limit(1);
  return rule && rule.active ? rule.amount : 0;
}

/**
 * Awards XP idempotently. XP is never cash and never touches the ledger.
 * Handles level-ups (including configured level rewards) and XP achievements.
 */
export async function awardXp(
  tx: Tx,
  userId: string,
  source: string,
  opts: { key: string; sourceId?: string; amount?: number },
): Promise<number> {
  const amount = opts.amount ?? (await xpForRule(tx, source));
  if (!amount || amount <= 0) return 0;
  const inserted = await tx
    .insert(xpTransactions)
    .values({ userId, amount, source, sourceId: opts.sourceId, idempotencyKey: opts.key })
    .onConflictDoNothing()
    .returning({ id: xpTransactions.id });
  if (inserted.length === 0) return 0;

  const [updated] = await tx
    .update(profiles)
    .set({ xpTotal: sql`${profiles.xpTotal} + ${amount}`, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning({ xpTotal: profiles.xpTotal, xpLevel: profiles.xpLevel });

  const reached = await tx
    .select()
    .from(xpLevels)
    .where(and(lte(xpLevels.xpRequired, updated.xpTotal), gt(xpLevels.level, updated.xpLevel)))
    .orderBy(asc(xpLevels.level));
  if (reached.length > 0) {
    const top = reached[reached.length - 1];
    await tx.update(profiles).set({ xpLevel: top.level }).where(eq(profiles.id, userId));
    for (const level of reached) {
      const rewards = await grantPool(tx, userId, level.rewardPoolId, {
        sourceType: "xp_level",
        sourceId: String(level.level),
        key: `xp-level:${userId}:${level.level}`,
      });
      await notify(
        tx,
        userId,
        "REWARD",
        `Level ${level.level}: ${level.title}`,
        rewards.length ? `You levelled up and earned ${rewards.map((r) => r.display).join(", ")}.` : "You levelled up. Keep exploring!",
        "/app/progress",
      );
    }
    await checkAchievements(tx, userId, "XP_LEVEL");
  }
  return amount;
}

export async function levelProgress(tx: Tx | typeof import("@/db").db, xpTotal: number, level: number) {
  const levels = await tx.select().from(xpLevels).orderBy(asc(xpLevels.level));
  const current = levels.find((l) => l.level === level) ?? levels[0];
  const next = levels.find((l) => l.level === level + 1) ?? null;
  const floor = current?.xpRequired ?? 0;
  const ceil = next?.xpRequired ?? floor;
  const pct = next ? Math.min(100, Math.round(((xpTotal - floor) / Math.max(1, ceil - floor)) * 100)) : 100;
  return { current, next, pct, toNext: next ? Math.max(0, ceil - xpTotal) : 0 };
}
