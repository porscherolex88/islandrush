import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { mysteryBoxPlays, profiles } from "@/db/schema";
import { maskName } from "@/lib/mask-name";
import { activityReady, loadLandingStats, loadRecentActivity } from "@/server/queries/landing";
import { makeBox, makePool, makeUser, uid } from "./helpers";

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

describe("maskName", () => {
  it("keeps only the first and last letter of the first name", () => {
    expect(maskName("Jessica Tan")).toBe("J***a");
    expect(maskName("  Mark ")).toBe("M***k");
    expect(maskName("Al")).toBe("A***");
    expect(maskName("")).toBe("Player");
    expect(maskName(null)).toBe("Player");
  });
});

describe("landing activity", () => {
  it("lists real player box openings anonymised and hides staff", async () => {
    const pool = await makePool("WEIGHTED", [{ rewardType: "CREDITS", amount: "10" }]);
    const box = await makeBox(pool.id, 100, { name: "Sunken Chest", level: 2 });
    const player = await makeUser();
    await db.update(profiles).set({ name: "Rosalind Lee" }).where(eq(profiles.id, player.id));
    const staff = await makeUser({ role: "SUPPORT" });

    for (const u of [player, staff]) {
      await db.insert(mysteryBoxPlays).values({
        userId: u.id,
        boxId: box.id,
        selectedIndex: 0,
        creditsSpent: 100,
        reward: {},
        idempotencyKey: uid("idem"),
        appDay: "2026-10-10",
        level: 2,
      });
    }

    const events = await loadRecentActivity(50);
    const mine = events.filter((e) => e.detail === "Sunken Chest");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ kind: "box", player: "R***d", level: 2 });
    expect(JSON.stringify(events)).not.toContain(player.id);

    const stats = await loadLandingStats();
    expect(stats.boxesOpened).toBeGreaterThanOrEqual(2);
    expect(stats.players).toBeGreaterThanOrEqual(1);
  });

  it("caps one player and hides the ticker when names are not varied enough", async () => {
    const pool = await makePool("WEIGHTED", [{ rewardType: "CREDITS", amount: "10" }]);
    const box = await makeBox(pool.id, 100, { name: "Solo Chest", level: 1 });
    const player = await makeUser();
    await db.update(profiles).set({ name: "Daniel Wong" }).where(eq(profiles.id, player.id));

    for (let i = 0; i < 8; i++) {
      await db.insert(mysteryBoxPlays).values({
        userId: player.id,
        boxId: box.id,
        selectedIndex: 0,
        creditsSpent: 100,
        reward: {},
        idempotencyKey: uid("idem"),
        appDay: "2026-10-11",
        level: 1,
      });
    }

    const events = await loadRecentActivity(20);
    const daniel = events.filter((e) => e.player === "D***l" && e.detail === "Solo Chest");
    expect(daniel.length).toBeLessThanOrEqual(2);
    expect(activityReady(daniel)).toBe(false);
  });
});
