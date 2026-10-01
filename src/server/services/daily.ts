import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbOrTx, type Tx } from "@/db";
import {
  dailyEventClaims,
  dailyLogins,
  dailySchedules,
  dailySpins,
  missionBonusClaims,
  missionDefinitions,
  missionProgress,
  streakMilestoneClaims,
  streakMilestones,
  tileDiscoveries,
  userStreaks,
} from "@/db/schema";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { appDay, daysBetween } from "@/lib/time";
import { checkAchievements } from "./achievements";
import { getConfig } from "./config";
import { postTransaction } from "./ledger";
import { notify } from "./notifications";
import { grantPool, grantReward, pickPoolEntry, type RewardResult } from "./rewards";
import { awardXp } from "./xp";

export type MissionAction = (typeof missionDefinitions.$inferSelect)["action"];
export type MissionDef = typeof missionDefinitions.$inferSelect;

export async function today(tx: DbOrTx = db): Promise<string> {
  return appDay(new Date(), await getConfig("timezone", tx));
}

function dayIndex(day: string) {
  return Math.abs(daysBetween("2024-01-01", day));
}

export type DailyPlan = {
  day: string;
  scheduled: boolean;
  spinPoolId: string | null;
  missions: MissionDef[];
  missionBonusPoolId: string | null;
  event: { title: string; description: string; icon: string; poolId: string | null; costCredits: number } | null;
  freeDiscoveries: number;
};

/** Resolves the daily content for a day: a published calendar schedule, otherwise the configured defaults. */
export async function getDailyPlan(day: string, tx: DbOrTx = db, opts: { includeDrafts?: boolean } = {}): Promise<DailyPlan> {
  const defaults = await getConfig("daily_defaults", tx);
  const [schedule] = await tx.select().from(dailySchedules).where(eq(dailySchedules.day, day)).limit(1);
  const s = schedule && (schedule.status === "PUBLISHED" || opts.includeDrafts) ? schedule : null;

  const active = await tx.select().from(missionDefinitions).where(eq(missionDefinitions.active, true)).orderBy(asc(missionDefinitions.key));
  let missions: MissionDef[] = [];
  const scheduledIds = s ? [s.mission1Id, s.mission2Id, s.mission3Id].filter(Boolean) as string[] : [];
  if (scheduledIds.length === 3) {
    const rows = await tx.select().from(missionDefinitions).where(inArray(missionDefinitions.id, scheduledIds));
    missions = scheduledIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as MissionDef[];
  }
  if (missions.length !== 3) {
    const rotation = defaults.missionKeys.length ? active.filter((m) => defaults.missionKeys.includes(m.key)) : active;
    const pool = rotation.length >= 3 ? rotation : active;
    const start = pool.length ? dayIndex(day) % pool.length : 0;
    missions = [];
    for (let i = 0; i < Math.min(3, pool.length); i++) missions.push(pool[(start + i) % pool.length]);
  }

  const eventPoolId = s?.eventPoolId ?? defaults.eventPoolId;
  return {
    day,
    scheduled: Boolean(s),
    spinPoolId: s?.spinPoolId ?? defaults.spinPoolId,
    missions,
    missionBonusPoolId: s?.missionBonusPoolId ?? defaults.missionBonusPoolId,
    event: eventPoolId
      ? {
          title: s?.eventTitle ?? defaults.eventTitle,
          description: s?.eventDescription ?? defaults.eventDescription,
          icon: s?.eventIcon ?? defaults.eventIcon,
          poolId: eventPoolId,
          costCredits: s?.eventCostCredits ?? 0,
        }
      : null,
    freeDiscoveries: s?.freeDiscoveries ?? defaults.freeDiscoveries,
  };
}

/** Advances today's missions for an action. Safe to call from any game transaction. */
export async function trackMission(tx: Tx, userId: string, action: MissionAction, inc = 1) {
  const day = await today(tx);
  const plan = await getDailyPlan(day, tx);
  for (const mission of plan.missions.filter((m) => m.action === action)) {
    const [existing] = await tx
      .select()
      .from(missionProgress)
      .where(and(eq(missionProgress.userId, userId), eq(missionProgress.day, day), eq(missionProgress.missionId, mission.id)))
      .limit(1);
    if (existing?.completedAt) continue;
    const next = Math.min(mission.target, (existing?.progress ?? 0) + inc);
    const completed = next >= mission.target;
    await tx
      .insert(missionProgress)
      .values({ userId, day, missionId: mission.id, progress: next, completedAt: completed ? new Date() : null })
      .onConflictDoUpdate({
        target: [missionProgress.userId, missionProgress.day, missionProgress.missionId],
        set: { progress: next, completedAt: completed ? new Date() : null, updatedAt: new Date() },
      });
    if (completed) {
      await awardXp(tx, userId, "MISSION_COMPLETE", { key: `xp:mission:${userId}:${day}:${mission.id}`, sourceId: mission.id });
      await notify(tx, userId, "MISSION", `${mission.icon} Mission complete`, mission.title, "/app/daily");
    }
  }
}

/* ------------------------------------------------------------------------- */

export async function claimDailyLogin(userId: string) {
  return db.transaction(async (tx) => {
    const day = await today(tx);
    const inserted = await tx
      .insert(dailyLogins)
      .values({ userId, day, streakAfter: 0 })
      .onConflictDoNothing()
      .returning({ id: dailyLogins.id });
    if (inserted.length === 0) throw new AppError("You've already checked in today. Come back tomorrow!", "ALREADY_CLAIMED");

    await tx.insert(userStreaks).values({ userId }).onConflictDoNothing();
    const [streak] = await tx.select().from(userStreaks).where(eq(userStreaks.userId, userId)).for("update");
    const { streakGraceDays } = await getConfig("daily_defaults", tx);
    const gap = streak.lastClaimDay ? daysBetween(streak.lastClaimDay, day) : Infinity;
    const continues = gap >= 1 && gap <= 1 + streakGraceDays;
    const current = continues ? streak.current + 1 : 1;
    const runStartDay = continues && streak.runStartDay ? streak.runStartDay : day;
    const longest = Math.max(streak.longest, current);
    await tx
      .update(userStreaks)
      .set({ current, longest, lastClaimDay: day, runStartDay, updatedAt: new Date() })
      .where(eq(userStreaks.userId, userId));

    const xp = await awardXp(tx, userId, "DAILY_LOGIN", { key: `xp:login:${userId}:${day}` });
    await tx.update(dailyLogins).set({ streakAfter: current, xpAwarded: xp }).where(eq(dailyLogins.id, inserted[0].id));

    const milestoneRewards: { title: string; days: number; rewards: RewardResult[] }[] = [];
    const milestones = await tx
      .select()
      .from(streakMilestones)
      .where(and(eq(streakMilestones.active, true), eq(streakMilestones.days, current)));
    for (const m of milestones) {
      const claim = await tx
        .insert(streakMilestoneClaims)
        .values({ userId, milestoneId: m.id, runStartDay })
        .onConflictDoNothing()
        .returning({ id: streakMilestoneClaims.id });
      if (claim.length === 0) continue;
      const rewards = await grantPool(tx, userId, m.rewardPoolId, {
        sourceType: "streak_milestone",
        sourceId: m.id,
        key: `streak:${userId}:${m.id}:${runStartDay}`,
      });
      await tx.update(streakMilestoneClaims).set({ rewards }).where(eq(streakMilestoneClaims.id, claim[0].id));
      await awardXp(tx, userId, "STREAK_MILESTONE", { key: `xp:streak:${userId}:${m.id}:${runStartDay}`, sourceId: m.id });
      await notify(tx, userId, "REWARD", `🔥 ${m.days}-day streak!`, `${m.title}: ${rewards.map((r) => r.display).join(", ") || "Milestone reached"}`, "/app/daily");
      milestoneRewards.push({ title: m.title, days: m.days, rewards });
    }

    await trackMission(tx, userId, "DAILY_LOGIN");
    await checkAchievements(tx, userId, "STREAK_DAYS");
    return { streak: current, longest, xp, milestoneRewards };
  });
}

export async function spinDaily(userId: string) {
  try {
    return await db.transaction(async (tx) => {
      const day = await today(tx);
      const [existing] = await tx.select().from(dailySpins).where(and(eq(dailySpins.userId, userId), eq(dailySpins.day, day))).limit(1);
      if (existing) throw new AppError("You've already used today's spin. A new spin unlocks tomorrow.", "ALREADY_SPUN");
      const plan = await getDailyPlan(day, tx);
      const defaults = await getConfig("daily_defaults", tx);
      const [streak] = await tx.select().from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1);
      const boosted = defaults.streakSpinPoolId && (streak?.current ?? 0) >= defaults.streakSpinMinDays;
      const poolId = boosted ? defaults.streakSpinPoolId : plan.spinPoolId;
      if (!poolId) throw new AppError("Daily Spin is not available today", "SPIN_UNAVAILABLE");

      const [spin] = await tx.insert(dailySpins).values({ userId, day, poolId, reward: {} }).returning();
      const entry = await pickPoolEntry(tx, poolId);
      const reward = await grantReward(tx, userId, entry, { sourceType: "daily_spin", sourceId: spin.id, key: `spin:${userId}:${day}` });
      await tx.update(dailySpins).set({ reward, poolEntryId: entry.id }).where(eq(dailySpins.id, spin.id));
      const xp = await awardXp(tx, userId, "DAILY_SPIN", { key: `xp:spin:${userId}:${day}`, sourceId: spin.id });
      await trackMission(tx, userId, "DAILY_SPIN");
      return { reward, xp, boosted: Boolean(boosted), entryId: entry.id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("You've already used today's spin.", "ALREADY_SPUN");
    throw err;
  }
}

export async function claimMissionBonus(userId: string) {
  return db.transaction(async (tx) => {
    const day = await today(tx);
    const plan = await getDailyPlan(day, tx);
    const progress = await tx
      .select()
      .from(missionProgress)
      .where(and(eq(missionProgress.userId, userId), eq(missionProgress.day, day)));
    const done = plan.missions.every((m) => progress.find((p) => p.missionId === m.id)?.completedAt);
    if (plan.missions.length !== 3 || !done) throw new AppError("Complete all three missions first", "MISSIONS_INCOMPLETE");
    const inserted = await tx.insert(missionBonusClaims).values({ userId, day }).onConflictDoNothing().returning({ id: missionBonusClaims.id });
    if (inserted.length === 0) throw new AppError("Today's mission reward has already been claimed", "ALREADY_CLAIMED");
    const rewards = await grantPool(tx, userId, plan.missionBonusPoolId, {
      sourceType: "missions_all",
      sourceId: day,
      key: `missions:${userId}:${day}`,
    });
    await tx.update(missionBonusClaims).set({ rewards }).where(eq(missionBonusClaims.id, inserted[0].id));
    const xp = await awardXp(tx, userId, "MISSIONS_ALL", { key: `xp:missions-all:${userId}:${day}` });
    await notify(tx, userId, "MISSION", "🎯 All daily missions complete", rewards.map((r) => r.display).join(", ") || "Great work today!", "/app/daily");
    return { rewards, xp };
  });
}

export async function claimDailyEvent(userId: string) {
  try {
    return await db.transaction(async (tx) => {
      const day = await today(tx);
      const plan = await getDailyPlan(day, tx);
      if (!plan.event?.poolId) throw new AppError("There is no mystery event today", "NO_EVENT");
      const inserted = await tx
        .insert(dailyEventClaims)
        .values({ userId, day, creditsSpent: plan.event.costCredits, reward: {} })
        .onConflictDoNothing()
        .returning({ id: dailyEventClaims.id });
      if (inserted.length === 0) throw new AppError("You've already explored today's event", "ALREADY_CLAIMED");
      if (plan.event.costCredits > 0) {
        const cost = BigInt(plan.event.costCredits);
        await postTransaction(tx, {
          type: "GAME_SPEND",
          userId,
          idempotencyKey: `event-spend:${userId}:${day}`,
          description: `Daily Mystery Event: ${plan.event.title}`,
          sourceType: "daily_event",
          sourceId: inserted[0].id,
          entries: [
            { userId, account: "CREDITS", amount: -cost },
            { account: "SYS_GAME_REVENUE", currency: "CREDITS", amount: cost },
          ],
        });
      }
      const entry = await pickPoolEntry(tx, plan.event.poolId);
      const reward = await grantReward(tx, userId, entry, { sourceType: "daily_event", sourceId: inserted[0].id, key: `event:${userId}:${day}` });
      await tx.update(dailyEventClaims).set({ reward }).where(eq(dailyEventClaims.id, inserted[0].id));
      const xp = await awardXp(tx, userId, "DAILY_EVENT", { key: `xp:event:${userId}:${day}` });
      await trackMission(tx, userId, "DAILY_EVENT");
      return { reward, xp };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("You've already explored today's event", "ALREADY_CLAIMED");
    throw err;
  }
}

export async function freeDiscoveriesUsed(tx: DbOrTx, userId: string, day: string) {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(tileDiscoveries)
    .where(and(eq(tileDiscoveries.userId, userId), eq(tileDiscoveries.appDay, day), eq(tileDiscoveries.usedFreeDiscovery, true)));
  return row?.n ?? 0;
}

export async function getDailyState(userId: string) {
  const day = await today();
  const plan = await getDailyPlan(day);
  const [[login], [spin], progress, [bonus], [eventClaim], [streak], milestones, usedFree] = await Promise.all([
    db.select().from(dailyLogins).where(and(eq(dailyLogins.userId, userId), eq(dailyLogins.day, day))).limit(1),
    db.select().from(dailySpins).where(and(eq(dailySpins.userId, userId), eq(dailySpins.day, day))).limit(1),
    db.select().from(missionProgress).where(and(eq(missionProgress.userId, userId), eq(missionProgress.day, day))),
    db.select().from(missionBonusClaims).where(and(eq(missionBonusClaims.userId, userId), eq(missionBonusClaims.day, day))).limit(1),
    db.select().from(dailyEventClaims).where(and(eq(dailyEventClaims.userId, userId), eq(dailyEventClaims.day, day))).limit(1),
    db.select().from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1),
    db.select().from(streakMilestones).where(eq(streakMilestones.active, true)).orderBy(asc(streakMilestones.days)),
    freeDiscoveriesUsed(db, userId, day),
  ]);
  const { streakGraceDays } = await getConfig("daily_defaults");
  const gap = streak?.lastClaimDay ? daysBetween(streak.lastClaimDay, day) : Infinity;
  const streakAlive = gap <= 1 + streakGraceDays;
  const currentStreak = streakAlive ? streak?.current ?? 0 : 0;
  const missions = plan.missions.map((m) => {
    const p = progress.find((x) => x.missionId === m.id);
    return { ...m, progress: p?.progress ?? 0, completed: Boolean(p?.completedAt) };
  });
  return {
    day,
    loginClaimed: Boolean(login),
    spin: spin ? (spin.reward as RewardResult) : null,
    spinAvailable: Boolean(plan.spinPoolId),
    missions,
    missionsDone: missions.filter((m) => m.completed).length,
    bonusClaimed: Boolean(bonus),
    event: plan.event,
    eventClaim: eventClaim ? (eventClaim.reward as RewardResult) : null,
    freeDiscoveries: plan.freeDiscoveries,
    freeDiscoveriesLeft: Math.max(0, plan.freeDiscoveries - usedFree),
    streak: { current: currentStreak, longest: streak?.longest ?? 0, lastClaimDay: streak?.lastClaimDay ?? null },
    milestones: milestones.map((m) => ({ id: m.id, days: m.days, title: m.title, reached: currentStreak >= m.days })),
    nextMilestone: milestones.find((m) => m.days > currentStreak) ?? null,
  };
}
