import { describe, expect, it } from "vitest";
import { routeChests, type CheckpointState } from "@/lib/adventure";

const cp = (lootRequired: number, state: CheckpointState = "locked", isNext = false) => ({ lootRequired, state, isNext });

describe("routeChests", () => {
  it("gives each route the Loot between the previous threshold and its own", () => {
    const chests = routeChests([cp(15, "available", true), cp(17), cp(20), cp(27)], 12, 16);
    expect(chests.map((c) => c.need)).toEqual([3, 2, 3, 7]);
    expect(chests.map((c) => c.from)).toEqual([12, 15, 17, 20]);
    expect(chests[0]).toMatchObject({ have: 3, state: "full" });
    expect(chests[1]).toMatchObject({ have: 1, state: "locked" });
  });

  it("marks collected routes opened and the current route filling", () => {
    const chests = routeChests([cp(15, "completed"), cp(17, "locked", true), cp(20)], 12, 15);
    expect(chests.map((c) => c.state)).toEqual(["opened", "filling", "locked"]);
    expect(chests[1].have).toBe(0);
  });

  it("never reports negative progress before the map threshold is reached", () => {
    const [first] = routeChests([cp(15)], 12, 4);
    expect(first).toMatchObject({ need: 3, have: 0, state: "locked" });
  });
});
