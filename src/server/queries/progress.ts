import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { achievements, userAchievements, xpTransactions } from "@/db/schema";
import { metricFor, type AchievementCondition } from "@/server/services/achievements";
import { depositLevelProgress } from "@/server/services/deposit-levels";
import type { Profile } from "@/server/services/profiles";
import { levelProgress } from "@/server/services/xp";

const STAT_CONDITIONS: { condition: AchievementCondition; label: string; icon: string }[] = [
  { condition: "BOXES_OPENED", label: "Boxes opened", icon: "🎁" },
  { condition: "TILES_DISCOVERED", label: "Tiles discovered", icon: "🧭" },
  { condition: "AREAS_UNLOCKED", label: "Areas unlocked", icon: "🚪" },
  { condition: "ITEMS_COLLECTED", label: "Items collected", icon: "🎒" },
  { condition: "COLLECTIONS_COMPLETED", label: "Collections completed", icon: "🏺" },
  { condition: "VAULTS_UNLOCKED", label: "Vaults opened", icon: "🏛️" },
  { condition: "STREAK_DAYS", label: "Longest streak", icon: "🔥" },
];

export async function getProgress(user: Profile) {
  const [xp, deposit, allAchievements, mine, recentXp] = await Promise.all([
    levelProgress(db, user.xpTotal, user.xpLevel),
    depositLevelProgress(user.id),
    db.select().from(achievements).where(eq(achievements.active, true)).orderBy(asc(achievements.threshold)),
    db.select().from(userAchievements).where(eq(userAchievements.userId, user.id)),
    db.select().from(xpTransactions).where(eq(xpTransactions.userId, user.id)).orderBy(desc(xpTransactions.createdAt)).limit(8),
  ]);
  const conditions = Array.from(new Set([...allAchievements.map((a) => a.condition), ...STAT_CONDITIONS.map((s) => s.condition)]));
  const metrics = Object.fromEntries(await Promise.all(conditions.map(async (c) => [c, await metricFor(db, user.id, c)] as const))) as Record<AchievementCondition, number>;

  return {
    xp: { total: user.xpTotal, level: user.xpLevel, ...xp },
    deposit,
    achievements: allAchievements.map((a) => {
      const earned = mine.find((m) => m.achievementId === a.id);
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        badgeName: a.badgeName,
        badgeIcon: a.badgeIcon,
        threshold: a.threshold,
        current: Math.min(metrics[a.condition] ?? 0, a.threshold),
        earnedAt: earned?.createdAt ?? null,
      };
    }),
    stats: STAT_CONDITIONS.map((s) => ({ ...s, value: metrics[s.condition] ?? 0 })),
    recentXp,
  };
}
