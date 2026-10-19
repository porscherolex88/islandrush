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
    expect(state.maps[0].state).toBe("exploring");
    expect(state.maps[0].checkpoints.map((c) => [c.name, c.lootRequired])).toEqual([
      ["Driftwood Camp", 9],
      ["Lighthouse Point", 18],
      ["Hidden Lagoon", 27],
    ]);
    expect(state.maps.map((m) => m.checkpoints.length)).toEqual([3, 4, 4, 5, 5, 6, 6, 7, 7, 8]);
    expect(state.maps[1].checkpoints.map((c) => c.lootRequired)).toEqual([9, 18, 27, 36]);
    expect(state.maps.map((m) => m.checkpoints.at(-1)?.lootRequired)).toEqual([27, 36, 45, 54, 63, 72, 81, 90, 102, 113]);
    for (const m of state.maps) {
      const ys = m.checkpoints.map((c) => c.posY);
      expect(ys).toEqual([...ys].sort((a, b) => b - a));
    }
    expect(state.wheel).toEqual({ active: true });
  });
});
