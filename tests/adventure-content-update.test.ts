import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { appConfig, mapCheckpoints, maps } from "@/db/schema";
import { updateAdventureContent } from "@/server/content/adventure-seed";
import { getAdventureState } from "@/server/services/adventure";
import { makeUser } from "./helpers";

async function seeded(level: number, slug: string, name: string, stops: string[]) {
  const [map] = await db.insert(maps).values({ slug, name, level, lootRequired: 12 }).returning();
  await db.insert(mapCheckpoints).values(stops.map((n, k) => ({ mapId: map.id, position: k + 1, name: n, lootRequired: 15 + k * 2, isFinal: k === stops.length - 1 })));
  return map;
}

async function rows(mapId: string) {
  return db.select().from(mapCheckpoints).where(eq(mapCheckpoints.mapId, mapId)).orderBy(asc(mapCheckpoints.position));
}

describe("adventure content updates", () => {
  it("re-lays originally seeded routes to the tiered route counts, once, and leaves edited maps alone", async () => {
    const shore = await seeded(1, "map-1-lost-shore", "Lost Shore", ["Driftwood Camp", "Tide Caves", "Lighthouse Point", "Shipwreck Cove", "Coral Arch", "Hidden Lagoon"]);
    const jungle = await seeded(2, "map-2-hidden-jungle", "Hidden Jungle", ["Explorer's Camp", "Vine Bridge", "Waterfall Pool", "Parrot Ridge", "Overgrown Shrine", "Heart of the Jungle"]);
    const sky = await seeded(8, "map-8-sky-fortress", "Sky Fortress", ["Cloud Stair", "Wind Gate", "Floating Garden", "Watchtower", "Storm Bridge", "Fortress Keep"]);
    const edited = await seeded(9, "map-9-dragons-realm", "Dragon's Realm", ["Ash Fields", "My Custom Stop", "Dragon's Hoard"]);

    await updateAdventureContent();
    await updateAdventureContent();

    const shoreRows = await rows(shore.id);
    expect(shoreRows.filter((r) => r.status === "PUBLISHED").map((r) => [r.name, r.lootRequired])).toEqual([
      ["Driftwood Camp", 9],
      ["Lighthouse Point", 18],
      ["Hidden Lagoon", 27],
    ]);
    expect(shoreRows.filter((r) => r.status === "DRAFT").map((r) => r.name)).toEqual(["Tide Caves", "Shipwreck Cove", "Coral Arch"]);

    const live = async (mapId: string) => (await rows(mapId)).filter((r) => r.status === "PUBLISHED");
    expect((await live(jungle.id)).map((r) => r.name)).toEqual(["Explorer's Camp", "Vine Bridge", "Waterfall Pool", "Heart of the Jungle"]);
    const skyRows = await live(sky.id);
    expect(skyRows.map((r) => r.name)).toEqual(["Cloud Stair", "Wind Gate", "Floating Garden", "Watchtower", "Storm Bridge", "Thunder Peak", "Fortress Keep"]);
    expect(skyRows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(skyRows.at(-1)?.isFinal).toBe(true);
    expect((await live(edited.id)).map((r) => r.name)).toEqual(["Ash Fields", "My Custom Stop", "Dragon's Hoard"]);

    const state = await getAdventureState((await makeUser()).id);
    expect(state.maps.map((m) => m.checkpoints.length)).toEqual([3, 4, 7, 3]);
  });

  it("spreads untouched Map 2-10 chests evenly from zero and leaves edited chests alone", async () => {
    const stops = ["Temple Steps", "Hall of Echoes", "Serpent Corridor", "Fire Altar", "Temple Vault"];
    const [temple] = await db.insert(maps).values({ slug: "map-4-even", name: "Forgotten Temple", level: 4 }).returning();
    await db.insert(mapCheckpoints).values(stops.map((n, k) => ({ mapId: temple.id, position: k + 1, name: n, lootRequired: [30, 36, 42, 48, 54][k], isFinal: k === 4 })));
    const caveStops = ["Cavern Mouth", "Glowing Tunnel", "Echo Lake", "Crystal Garden", "Crystal Throne"];
    const [caves] = await db.insert(maps).values({ slug: "map-5-edited", name: "Crystal Caverns", level: 5 }).returning();
    await db.insert(mapCheckpoints).values(caveStops.map((n, k) => ({ mapId: caves.id, position: k + 1, name: n, lootRequired: 5 * (k + 1), isFinal: k === 4 })));
    const [row] = await db.select().from(appConfig).where(eq(appConfig.key, "adventure_content_updates"));
    const applied = (row.value as { applied: string[] }).applied.filter((id) => id !== "even-chest-thresholds");
    await db.update(appConfig).set({ value: { applied } }).where(eq(appConfig.key, "adventure_content_updates"));

    await updateAdventureContent();

    expect((await rows(temple.id)).map((r) => r.lootRequired)).toEqual([11, 22, 32, 43, 54]);
    expect((await rows(caves.id)).map((r) => r.lootRequired)).toEqual([5, 10, 15, 20, 25]);
  });
});
