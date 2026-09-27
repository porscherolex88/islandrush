import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { achievements, profiles, streakMilestones, userAchievements, userStreaks, xpTransactions } from "@/db/schema";
import { addDays } from "@/lib/time";
import { createAdjustment } from "@/server/services/admin-finance";
import {
  claimDailyEvent,
  claimDailyLogin,
  claimMissionBonus,
  getDailyPlan,
  getDailyState,
  spinDaily,
  today,
} from "@/server/services/daily";
import { levelForTotal, listDepositLevels } from "@/server/services/deposit-levels";
import { getBalances } from "@/server/services/ledger";
import { discoverTile } from "@/server/services/map";
import { playMysteryBox } from "@/server/services/mystery-box";
import {
  admin,
  ensureAdminActor,
  fundCash,
  makeArea,
  makeBox,
  makeMap,
  makePool,
  makeTiles,
  makeUser,
  seedMissions,
  seedProgression,
  setConfigRaw,
  uid,
} from "./helpers";

let spinPoolId: string;
let bonusPoolId: string;

beforeAll(async () => {
  await seedProgression();
  await seedMissions();
  await ensureAdminActor();
  spinPoolId = (await makePool("WEIGHTED", [{ label: "200 Credits", rewardType: "CREDITS", amount: "200" }])).id;
  bonusPoolId = (await makePool("ALL", [{ label: "Bonus", rewardType: "CREDITS", amount: "1000" }])).id;
  const eventPool = await makePool("WEIGHTED", [{ label: "Event XP", rewardType: "XP", amount: "40" }]);
  await setConfigRaw("daily_defaults", {
    spinPoolId,
    missionBonusPoolId: bonusPoolId,
    missionKeys: ["open_box", "discover_2", "spin"],
    eventPoolId: eventPool.id,
    freeDiscoveries: 0,
  });
});

describe("daily spin", () => {
  it("allows exactly one server-determined spin per day", async () => {
    const u = await makeUser();
    const res = await spinDaily(u.id);
    expect(res.reward.amount).toBe("200.00");
    await expect(spinDaily(u.id)).rejects.toThrow(/already/);
    expect((await getBalances(u.id)).CREDITS).toBe(200n);
  });
});

describe("daily missions", () => {
  it("has exactly three missions, tracks progress and pays the bonus once", async () => {
    const plan = await getDailyPlan(await today());
    expect(plan.missions).toHaveLength(3);
    const u = await makeUser();
    await expect(claimMissionBonus(u.id)).rejects.toThrow(/Complete all three/);

    const pool = await makePool("WEIGHTED", [{ label: "x", rewardType: "CREDITS", amount: "1" }]);
    const box = await makeBox(pool.id, 100);
    const map = await makeMap();
    const area = await makeArea(map.id, { discoveryCostCredits: 10, discoveryPoolId: pool.id });
    const tiles = await makeTiles(area.id, 2);
    await createAdjustment(admin, { userId: u.id, account: "CREDITS", direction: "CREDIT", amount: "1000", reason: "Test credits", note: "", idempotencyKey: uid() });

    await playMysteryBox(u.id, { boxId: box.id, selectedIndex: 0, idempotencyKey: uid() });
    await discoverTile(u.id, tiles[0].id);
    let state = await getDailyState(u.id);
    expect(state.missions.find((m) => m.key === "discover_2")?.progress).toBe(1);
    expect(state.missionsDone).toBe(1);
    await discoverTile(u.id, tiles[1].id);
    await spinDaily(u.id);
    state = await getDailyState(u.id);
    expect(state.missionsDone).toBe(3);

    const before = (await getBalances(u.id)).CREDITS;
    const bonus = await claimMissionBonus(u.id);
    expect(bonus.rewards).toHaveLength(1);
    expect((await getBalances(u.id)).CREDITS).toBe(before + 1000n);
    await expect(claimMissionBonus(u.id)).rejects.toThrow(/already/);
  });
});

describe("daily mystery event", () => {
  it("can be explored once per day", async () => {
    const u = await makeUser();
    const r = await claimDailyEvent(u.id);
    expect(r.reward.type).toBe("XP");
    await expect(claimDailyEvent(u.id)).rejects.toThrow(/already/);
  });
});

describe("streaks", () => {
  it("increments on consecutive days, resets after a gap, and pays milestones once per run", async () => {
    const milestonePool = await makePool("ALL", [{ label: "Streak bonus", rewardType: "CREDITS", amount: "300" }]);
    await db.insert(streakMilestones).values({ days: 3, title: "3-day streak", rewardPoolId: milestonePool.id }).onConflictDoNothing();
    const u = await makeUser();
    const day = await today();

    await db.update(userStreaks).set({ current: 2, longest: 2, lastClaimDay: addDays(day, -1), runStartDay: addDays(day, -2) }).where(eq(userStreaks.userId, u.id));
    const res = await claimDailyLogin(u.id);
    expect(res.streak).toBe(3);
    expect(res.milestoneRewards).toHaveLength(1);
    expect((await getBalances(u.id)).CREDITS).toBe(300n);
    await expect(claimDailyLogin(u.id)).rejects.toThrow(/already/);

    const u2 = await makeUser();
    await db.update(userStreaks).set({ current: 9, longest: 9, lastClaimDay: addDays(day, -3), runStartDay: addDays(day, -12) }).where(eq(userStreaks.userId, u2.id));
    const res2 = await claimDailyLogin(u2.id);
    expect(res2.streak).toBe(1);
    expect(res2.longest).toBe(9);
  });
});

describe("XP and levels", () => {
  it("awards XP idempotently, levels up and unlocks achievements", async () => {
    await db.insert(achievements).values({ key: uid("ach"), name: "Rising Star", description: "Reach level 2", condition: "XP_LEVEL", threshold: 2, badgeName: "Star" });
    const u = await makeUser();
    await claimDailyLogin(u.id); // 10 XP
    const pool = await makePool("WEIGHTED", [{ label: "x", rewardType: "CREDITS", amount: "1" }]);
    const box = await makeBox(pool.id, 10);
    await createAdjustment(admin, { userId: u.id, account: "CREDITS", direction: "CREDIT", amount: "100", reason: "Test credits", note: "", idempotencyKey: uid() });
    for (let i = 0; i < 2; i++) await playMysteryBox(u.id, { boxId: box.id, selectedIndex: i, idempotencyKey: uid() }); // 40 XP
    const [p] = await db.select().from(profiles).where(eq(profiles.id, u.id));
    expect(p.xpTotal).toBeGreaterThanOrEqual(50);
    expect(p.xpLevel).toBe(2);
    const earned = await db.select().from(userAchievements).where(eq(userAchievements.userId, u.id));
    expect(earned.length).toBeGreaterThanOrEqual(1);
    const xps = await db.select().from(xpTransactions).where(eq(xpTransactions.userId, u.id));
    expect(new Set(xps.map((x) => x.idempotencyKey)).size).toBe(xps.length);
    // XP never touches the wallet.
    expect((await getBalances(u.id)).CASH).toBe(0n);
  });
});

describe("Deposit Level", () => {
  it("is computed from cumulative approved deposits, independent of XP", async () => {
    const levels = await listDepositLevels();
    expect(levelForTotal(levels, "0")?.name).toBe("Starter");
    expect(levelForTotal(levels, "750.00")?.name).toBe("Bronze");
    const u = await makeUser();
    await fundCash(u.id, "300.00");
    await fundCash(u.id, "300.00");
    const [p] = await db.select().from(profiles).where(eq(profiles.id, u.id));
    const lvl = levels.find((l) => l.id === p.depositLevelId);
    expect(lvl?.name).toBe("Bronze");
    expect(p.xpLevel).toBe(1);
  });
});
