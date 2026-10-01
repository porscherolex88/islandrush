import { describe, expect, it } from "vitest";
import { adventureConfigWarnings, getAdventureState } from "@/server/services/adventure";
import { seedAdventure } from "@/server/content/adventure-seed";
import { makeUser } from "./helpers";

describe("adventure seed content", () => {
  it("creates a valid 10-level adventure and is safe to re-run", async () => {
    expect(await seedAdventure()).toBe(true);
    expect(await seedAdventure()).toBe(false);
    expect(await adventureConfigWarnings()).toEqual([]);
    const u = await makeUser();
    const state = await getAdventureState(u.id);
    expect(state.totalLevels).toBe(10);
    expect(state.boxes).toHaveLength(10);
    expect(state.maps).toHaveLength(10);
    expect(state.puzzles).toHaveLength(10);
    expect(state.boxes.filter((b) => !b.locked).map((b) => b.level)).toEqual([1]);
    expect(state.maps[0].state).toBe("collecting");
    expect(state.maps[0].checkpoints).toHaveLength(6);
    expect(state.wheel).toEqual({ active: true, prizeUnlockPct: 90, alternativePct: 10 });
  });
});
