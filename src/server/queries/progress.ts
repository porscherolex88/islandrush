import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { achievements, userAchievements } from "@/db/schema";
import { metricFor, type AchievementCondition } from "@/server/services/achievements";
import type { Profile } from "@/server/services/profiles";

const STAT_CONDITIONS: { condition: AchievementCondition; label: string }[] = [
  { condition: "BOXES_OPENED", label: "Boxes opened" },
  { condition: "ITEMS_COLLECTED", label: "Loot types found" },
  { condition: "STREAK_DAYS", label: "Longest streak" },
];

/** Conditions players can still progress. Others (retired island map, vaults, collection book) only show once earned. */
const LIVE_CONDITIONS = new Set<string>(["BOXES_OPENED", "ITEMS_COLLECTED", "STREAK_DAYS"]);

export async function getProgress(user: Profile) {
  const [allAchievements, mine] = await Promise.all([
    db.select().from(achievements).where(eq(achievements.active, true)).orderBy(asc(achievements.threshold)),
    db.select().from(userAchievements).where(eq(userAchievements.userId, user.id)),
  ]);
  const visible = allAchievements.filter((a) => String(a.condition) !== "XP_LEVEL" && (LIVE_CONDITIONS.has(a.condition) || mine.some((m) => m.achievementId === a.id)));
  const conditions = Array.from(new Set([...visible.map((a) => a.condition), ...STAT_CONDITIONS.map((s) => s.condition)]));
  const metrics = Object.fromEntries(await Promise.all(conditions.map(async (c) => [c, await metricFor(db, user.id, c)] as const))) as Record<AchievementCondition, number>;

  return {
    achievements: visible.map((a) => {
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
  };
}
