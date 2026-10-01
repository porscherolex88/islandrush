import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { mapCheckpoints, maps } from "@/db/schema";
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
});
