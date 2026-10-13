import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import * as s from "@/db/schema";
import { lootEmoji, roman } from "@/lib/adventure";
import { defaultTrail, densify, stopsAlong } from "@/lib/adventure-trails";

/**
 * Starting content for the 10-level adventure. Every number here is an example that admins
 * are expected to tune (prices, Loot thresholds, odds, prizes). Safe to run more than once.
 */
const MAP1_STOPS = ["Driftwood Camp", "Lighthouse Point", "Hidden Lagoon"];
/** Map 1 is the free starting map, so its Loot thresholds start from zero: three even chests of 9. */
const MAP1_THRESHOLDS = [9, 18, 27];

/** Higher maps have more routes, so the climb gets longer as the treasure gets richer. */
const MAPS = [
  { name: "Lost Shore", loot: 12, color: "#0ea5e9", items: [["Shore Shell", "shell"], ["Tide Pearl", "pearl"]], stops: MAP1_STOPS },
  { name: "Hidden Jungle", loot: 16, color: "#16a34a", items: [["Jungle Relic", "leaf"], ["Jade Idol", "idol"]], stops: ["Explorer's Camp", "Vine Bridge", "Waterfall Pool", "Heart of the Jungle"] },
  { name: "Ancient Ruins", loot: 20, color: "#a16207", items: [["Ancient Relic", "relic"], ["Carved Tablet", "scroll"]], stops: ["Broken Gate", "Pillar Hall", "Scribe's Library", "Ancient Gate"] },
  { name: "Forgotten Temple", loot: 24, color: "#d97706", items: [["Temple Fragment", "fragment"], ["Ancient Key", "key"]], stops: ["Temple Steps", "Hall of Echoes", "Serpent Corridor", "Fire Altar", "Temple Vault"] },
  { name: "Crystal Caverns", loot: 28, color: "#7c3aed", items: [["Cave Crystal", "crystal"], ["Glow Shard", "shard"]], stops: ["Cavern Mouth", "Glowing Tunnel", "Echo Lake", "Crystal Garden", "Crystal Throne"] },
  { name: "Golden Kingdom", loot: 32, color: "#ca8a04", items: [["Golden Coin", "coin"], ["Golden Idol", "crown"]], stops: ["Kingdom Road", "Market Square", "Royal Gardens", "Gilded Bridge", "Throne Hall", "Golden Treasury"] },
  { name: "Lost City", loot: 36, color: "#0f766e", items: [["City Seal", "seal"], ["Explorer's Compass", "compass"]], stops: ["City Outskirts", "Silent Plaza", "Old Aqueduct", "Observatory", "Palace Ruins", "City Heart"] },
  { name: "Sky Fortress", loot: 40, color: "#2563eb", items: [["Sky Feather", "feather"], ["Cloud Banner", "banner"]], stops: ["Cloud Stair", "Wind Gate", "Floating Garden", "Watchtower", "Storm Bridge", "Thunder Peak", "Fortress Keep"] },
  { name: "Dragon's Realm", loot: 45, color: "#b91c1c", items: [["Dragon Scale", "scale"], ["Ember Stone", "ember"]], stops: ["Ash Fields", "Ember Pass", "Bone Canyon", "Lava Falls", "Obsidian Bridge", "Dragon Gate", "Dragon's Hoard"] },
  { name: "Ultimate Treasure", loot: 50, color: "#be185d", items: [["Treasure Map Piece", "map"], ["Crown Jewel", "jewel"]], stops: ["Final Shore", "Treasure Gate", "Mirror Maze", "Sunken Vault", "Hall of Kings", "Jewel Bridge", "Map Room", "Ultimate Treasure"] },
] as const;

const PRICES = [2000, 4000, 6000, 8000, 12000, 18000, 25000, 35000, 50000, 75000];
const LANDMARKS = ["tent", "compass", "mountain", "landmark", "castle"];
const FINAL_LANDMARK = "treasure";

/** Checkpoint positions (percent of the map art), spaced evenly along the trail painted on each level's default illustration. */
function stopPositions(level: number, count: number): [number, number][] {
  return stopsAlong(densify(defaultTrail(level, null)!), count).map((p) => [Math.round(p.x), Math.round(p.y)]);
}

function stopContent(level: number, k: number) {
  const m = MAPS[level - 1];
  const n = m.stops.length;
  const isFinal = k === n - 1;
  const [posX, posY] = stopPositions(level, n)[k];
  return {
    name: m.stops[k],
    isFinal,
    landmark: isFinal ? FINAL_LANDMARK : LANDMARKS[k % LANDMARKS.length],
    lootRequired: level === 1 ? MAP1_THRESHOLDS[k] : m.loot + Math.ceil((m.loot * 1.25 * (k + 1)) / n),
    description: isFinal ? "The final checkpoint. Something is hidden here." : `Checkpoint ${k + 1} on the ${m.name} map.`,
    posX,
    posY,
  };
}

const PRIZES: { name: string; kind: "PHYSICAL" | "CREDITS" | "CASH"; amount?: string; est?: string; stock?: number; description: string }[] = [
  { name: "5,000 Credits Bundle", kind: "CREDITS", amount: "5000", description: "A bundle of Credits added straight to your balance." },
  { name: "Jungle Cash Reward", kind: "CASH", amount: "50.00", description: "A cash reward that follows the normal review period before it becomes withdrawable." },
  { name: "Wireless Earbuds", kind: "PHYSICAL", est: "300.00", stock: 50, description: "Premium true-wireless earbuds, delivered to you." },
  { name: "Smartwatch", kind: "PHYSICAL", est: "900.00", stock: 30, description: "A fitness and lifestyle smartwatch." },
  { name: "Crystal Cash Reward", kind: "CASH", amount: "500.00", description: "A cash reward that follows the normal review period before it becomes withdrawable." },
  { name: "Premium Smartphone", kind: "PHYSICAL", est: "4000.00", stock: 10, description: "A flagship smartphone." },
  { name: "Luxury Watch", kind: "PHYSICAL", est: "15000.00", stock: 5, description: "A luxury timepiece from the current prize pool." },
  { name: "Travel Package for Two", kind: "PHYSICAL", est: "20000.00", stock: 3, description: "A curated getaway for two. Dates subject to availability." },
  { name: "Premium Electronics Bundle", kind: "PHYSICAL", est: "25000.00", stock: 3, description: "A bundle of premium home and personal electronics." },
  { name: "Grand Prize Vehicle", kind: "PHYSICAL", est: "150000.00", stock: 1, description: "The grand prize at the end of the adventure. Model from the current prize pool." },
];
const ALTERNATIVES: [("CREDITS" | "CASH"), string][] = [
  ["CREDITS", "1000"],
  ["CREDITS", "2000"],
  ["CASH", "20.00"],
  ["CASH", "50.00"],
  ["CASH", "80.00"],
  ["CASH", "150.00"],
  ["CASH", "300.00"],
  ["CASH", "500.00"],
  ["CASH", "800.00"],
  ["CASH", "1500.00"],
];
/** Map 1 is a 3x3 puzzle, Maps 2-5 are 4x4, Maps 6-9 are 5x5, and Map 10 is 3x3 with rarer drops. */
const PIECES_REQUIRED = [9, 16, 16, 16, 16, 25, 25, 25, 25, 9];
const OLD_PIECES_REQUIRED = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2];
/** Chance (%) of 1, 2 or 3 pieces. Map 10's Big Mystery Box almost always holds a single piece. */
const bigBoxOdds = (level: number) => (level === 10 ? [90, 9, 1] : level <= 5 ? [40, 40, 20] : [30, 40, 30]);

/** One more free play of the same box. */
const freeUnlock = (price: number) => ({
  label: "Free unlock",
  rewardType: "FREE_UNLOCK" as const,
  amount: String(price),
  weight: 8,
  rarity: "EPIC" as const,
  reveal: { headline: "Free unlock!" },
});

export async function seedAdventure(log: (msg: string) => void = () => {}) {
  const [already] = await db.select().from(s.appConfig).where(eq(s.appConfig.key, "adventure_seed_version"));
  if (already) {
    log("Adventure content already seeded, skipping.");
    return false;
  }
  log("Seeding 10-level adventure...");

  type E = Omit<typeof s.rewardPoolEntries.$inferInsert, "poolId">;
  const pool = async (name: string, entries: E[], description = "") => {
    const [p] = await db.insert(s.rewardPools).values({ name, mode: "WEIGHTED", description }).returning();
    await db.insert(s.rewardPoolEntries).values(entries.map((e, i) => ({ ...e, poolId: p.id, sortOrder: i })));
    return p;
  };
  const credits = (n: number, weight: number, rarity: E["rarity"]): E => ({ label: `${n.toLocaleString("en-MY")} Credits`, rewardType: "CREDITS", amount: String(n), weight, rarity });
  const cash = (rm: number, weight: number, rarity: E["rarity"]): E => ({ label: `RM${rm.toFixed(2)} Cash Reward`, rewardType: "CASH", amount: rm.toFixed(2), weight, rarity });

  for (const [i, m] of MAPS.entries()) {
    const level = i + 1;
    const boxName = `${m.name} Box`;
    const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const price = PRICES[i];
    const rmValue = price / 60;

    const lootIds: string[] = [];
    for (const [j, [name, icon]] of m.items.entries()) {
      const values = {
        name,
        icon: lootEmoji(icon),
        kind: "LOOT" as const,
        rarity: j === 0 ? ("UNCOMMON" as const) : ("RARE" as const),
        adventureLevel: level,
        purpose: lootPurpose(level, m.name),
        description: `Found in the ${boxName}.`,
        sortOrder: level * 10 + j,
      };
      const [item] = await db
        .insert(s.items)
        .values({ slug: `loot-${slug}-${j + 1}`, ...values })
        .onConflictDoUpdate({ target: s.items.slug, set: { ...values, updatedAt: new Date() } })
        .returning();
      lootIds.push(item.id);
    }

    const base = 2 + Math.floor((level - 1) / 3);
    const lootPool = await pool(`${boxName} Loot`, [
      { label: `${base}× ${m.items[0][0]}`, rewardType: "ITEM", itemId: lootIds[0], amount: String(base), weight: 40, rarity: "UNCOMMON", reveal: { icon: lootEmoji(m.items[0][1]) } },
      { label: `${base + 1}× ${m.items[0][0]}`, rewardType: "ITEM", itemId: lootIds[0], amount: String(base + 1), weight: 32, rarity: "UNCOMMON", reveal: { icon: lootEmoji(m.items[0][1]) } },
      { label: `${base + 2}× ${m.items[0][0]}`, rewardType: "ITEM", itemId: lootIds[0], amount: String(base + 2), weight: 16, rarity: "UNCOMMON", reveal: { icon: lootEmoji(m.items[0][1]) } },
      { label: `${base + 2}× ${m.items[1][0]}`, rewardType: "ITEM", itemId: lootIds[1], amount: String(base + 2), weight: 12, rarity: "RARE", reveal: { icon: lootEmoji(m.items[1][1]) } },
    ], `Guaranteed Loot drop for every ${boxName}.`);
    const rewardPool = await pool(`${boxName} Rewards`, [
      credits(Math.round(price * 0.25), 40, "COMMON"),
      credits(Math.round(price * 0.5), 30, "UNCOMMON"),
      credits(price, 12, "RARE"),
      credits(price * 2, 3, "EPIC"),
      cash(Math.max(1, Math.round(rmValue * 0.5)), 10, "UNCOMMON"),
      cash(Math.max(1, Math.round(rmValue * 1.5)), 4, "RARE"),
      cash(Math.max(1, Math.round(rmValue * 5)), 1, "LEGENDARY"),
      freeUnlock(price),
    ], `Lucky drop table for the ${boxName}: Credits, Cash or a Free unlock.`);

    await db.insert(s.mysteryBoxes).values({
      slug: `mystery-box-${level}`,
      name: boxName,
      description: `Sealed on the ${m.name}. Every box holds ${m.name} Loot plus a lucky drop: Credits, Cash or a Free unlock.`,
      priceCredits: price,
      rewardPoolId: rewardPool.id,
      lootPoolId: lootPool.id,
      level,
      requiresMapLevel: level === 1 ? null : level - 1,
      theme: { color: m.color, accent: "#f59e0b" },
      sortOrder: 100 + level,
    });

    const [map] = await db
      .insert(s.maps)
      .values({ slug: `map-${level}-${slug}`, name: m.name, description: `Map ${level} of the adventure.`, level, lootRequired: m.loot, color: m.color })
      .returning();
    await db.insert(s.mapCheckpoints).values(m.stops.map((_, k) => ({ mapId: map.id, position: k + 1, ...stopContent(level, k) })));
    const odds = bigBoxOdds(level);
    await db.insert(s.bigMysteryBoxes).values({
      mapId: map.id,
      name: "Big Mystery Box",
      description: `Hidden at the end of the ${m.name}. Holds 1 to 3 Puzzle Pieces.`,
      pieces1Pct: odds[0],
      pieces2Pct: odds[1],
      pieces3Pct: odds[2],
    });

    const p = PRIZES[i];
    const [prize] = await db
      .insert(s.prizes)
      .values({
        level,
        name: p.name,
        description: p.description,
        kind: p.kind,
        amount: p.amount ?? "0",
        estimatedValue: p.est ?? null,
        inventoryTotal: p.stock ?? null,
        requiresVerification: p.kind === "PHYSICAL",
        claimInstructions: p.kind === "PHYSICAL" ? "Our team will contact you within 3 business days to confirm delivery details." : "",
      })
      .returning();
    const [altType, altAmount] = ALTERNATIVES[i];
    await db.insert(s.puzzles).values({
      level,
      name: `${m.name} Puzzle`,
      description: `Complete the ${m.name} Puzzle to reach the Level ${level} prize.`,
      piecesRequired: PIECES_REQUIRED[i],
      prizeId: prize.id,
      alternativeRewardType: altType,
      alternativeRewardAmount: altAmount,
    });
  }

  await db.insert(s.featureFlags).values({ key: "prize_wheel", enabled: true, description: "Final Prize Unlock" }).onConflictDoNothing();
  await db.insert(s.appConfig).values({ key: "prize_wheel", value: { active: true, prizeUnlockPct: 90, alternativePct: 10 } }).onConflictDoNothing();
  await db
    .update(s.missionDefinitions)
    .set({ title: "Discover a map checkpoint", target: 1 })
    .where(and(eq(s.missionDefinitions.key, "discover_2"), eq(s.missionDefinitions.action, "DISCOVER_TILE")));
  await db.insert(s.appConfig).values({ key: "adventure_seed_version", value: { version: 1, at: new Date().toISOString() } });
  log("Adventure content seeded.");
  return true;
}

/** Published checkpoint names per level as an earlier version of this seed created them. */
const ORIGINAL_STOPS: Record<number, string[]> = {
  1: ["Driftwood Camp", "Tide Caves", "Lighthouse Point", "Shipwreck Cove", "Coral Arch", "Hidden Lagoon"],
  2: ["Explorer's Camp", "Vine Bridge", "Waterfall Pool", "Parrot Ridge", "Overgrown Shrine", "Heart of the Jungle"],
  3: ["Broken Gate", "Sunken Courtyard", "Pillar Hall", "Scribe's Library", "Moon Stair", "Ancient Gate"],
  4: ["Temple Steps", "Hall of Echoes", "Serpent Corridor", "Fire Altar", "Inner Sanctum", "Temple Vault"],
  5: ["Cavern Mouth", "Glowing Tunnel", "Echo Lake", "Crystal Garden", "Deep Chasm", "Crystal Throne"],
  6: ["Kingdom Road", "Market Square", "Royal Gardens", "Gilded Bridge", "Throne Hall", "Golden Treasury"],
  7: ["City Outskirts", "Silent Plaza", "Old Aqueduct", "Observatory", "Palace Ruins", "City Heart"],
  8: ["Cloud Stair", "Wind Gate", "Floating Garden", "Watchtower", "Storm Bridge", "Fortress Keep"],
  9: ["Ash Fields", "Ember Pass", "Bone Canyon", "Lava Falls", "Dragon Gate", "Dragon's Hoard"],
  10: ["Final Shore", "Treasure Gate", "Mirror Maze", "Hall of Kings", "Map Room", "Ultimate Treasure"],
};

/**
 * Re-lays a map's route to the current seed stops, but only if its published checkpoints are still
 * exactly `expected`. Stops that are kept move to their new spot, new stops are added, and stops that
 * are no longer used are set to DRAFT (after the live ones) rather than deleted.
 */
async function relayRoute(tx: Tx, level: number, expected: readonly string[], log: (msg: string) => void) {
  const [map] = await tx.select().from(s.maps).where(and(eq(s.maps.level, level), eq(s.maps.status, "PUBLISHED")));
  if (!map) return;
  const all = (await tx.select().from(s.mapCheckpoints).where(eq(s.mapCheckpoints.mapId, map.id))).sort((a, b) => a.position - b.position);
  const live = all.filter((c) => c.status === "PUBLISHED");
  if (live.map((c) => c.name).join("|") !== expected.join("|")) return log(`Skipping Map ${level}: its checkpoints no longer match the original seed.`);

  const stops = MAPS[level - 1].stops;
  const now = new Date();
  await tx.update(s.mapCheckpoints).set({ position: sql`${s.mapCheckpoints.position} + 1000` }).where(eq(s.mapCheckpoints.mapId, map.id));
  for (const k of stops.keys()) {
    const content = stopContent(level, k);
    const existing = live.find((c) => c.name === content.name);
    if (existing) await tx.update(s.mapCheckpoints).set({ ...content, position: k + 1, updatedAt: now }).where(eq(s.mapCheckpoints.id, existing.id));
    else await tx.insert(s.mapCheckpoints).values({ ...content, mapId: map.id, position: k + 1 });
  }
  const unused = all.filter((c) => !(c.status === "PUBLISHED" && (stops as readonly string[]).includes(c.name)));
  for (const [j, c] of unused.entries()) {
    await tx.update(s.mapCheckpoints).set({ status: "DRAFT", position: stops.length + j + 1, updatedAt: now }).where(eq(s.mapCheckpoints.id, c.id));
  }
  log(`Map ${level} now has ${stops.length} routes.`);
}

/** Moves a map's checkpoints onto its current default trail, if it still uses the default art and the seeded stops. */
async function realignStops(tx: Tx, level: number, log: (msg: string) => void) {
  const [map] = await tx.select().from(s.maps).where(and(eq(s.maps.level, level), eq(s.maps.status, "PUBLISHED")));
  if (!map || map.artwork) return;
  const live = (await tx.select().from(s.mapCheckpoints).where(and(eq(s.mapCheckpoints.mapId, map.id), eq(s.mapCheckpoints.status, "PUBLISHED")))).sort((a, b) => a.position - b.position);
  const stops = MAPS[level - 1].stops;
  if (live.map((c) => c.name).join("|") !== stops.join("|")) return log(`Skipping Map ${level}: its checkpoints no longer match the seed.`);
  const spots = stopPositions(level, stops.length);
  for (const [k, c] of live.entries()) {
    await tx.update(s.mapCheckpoints).set({ posX: spots[k][0], posY: spots[k][1], updatedAt: new Date() }).where(eq(s.mapCheckpoints.id, c.id));
  }
  log(`Map ${level} checkpoints moved onto the new trail.`);
}

function lootPurpose(level: number, mapName: string) {
  return `Map ${level} Loot. Collect it to reach the checkpoints on ${mapName}. Loot stays in your collection.`;
}

const UPDATES: { id: string; run: (tx: Tx, log: (msg: string) => void) => Promise<void> }[] = [
  { id: "map1-three-routes", run: (tx, log) => relayRoute(tx, 1, ORIGINAL_STOPS[1], log) },
  {
    id: "tiered-routes",
    run: async (tx, log) => {
      for (const level of MAPS.keys()) await relayRoute(tx, level + 1, level === 0 ? MAP1_STOPS : ORIGINAL_STOPS[level + 1], log);
    },
  },
  {
    id: "stops-below-header",
    run: async (tx, log) => {
      for (const [i, m] of MAPS.entries()) await relayRoute(tx, i + 1, m.stops, log);
    },
  },
  {
    id: "shore-style-art",
    run: async (tx, log) => {
      for (let level = 2; level <= MAPS.length; level++) await realignStops(tx, level, log);
    },
  },
  {
    id: "box-free-unlock",
    run: async (tx, log) => {
      const boxes = await tx.select().from(s.mysteryBoxes).where(isNotNull(s.mysteryBoxes.level));
      for (const box of boxes) {
        const entries = await tx.select().from(s.rewardPoolEntries).where(eq(s.rewardPoolEntries.poolId, box.rewardPoolId));
        if (entries.some((e) => e.rewardType === "FREE_UNLOCK")) continue;
        const sortOrder = Math.max(0, ...entries.map((e) => e.sortOrder)) + 1;
        await tx.insert(s.rewardPoolEntries).values({ ...freeUnlock(box.priceCredits), poolId: box.rewardPoolId, sortOrder });
        const map = MAPS[(box.level as number) - 1];
        if (map && box.description === `Sealed on the ${map.name}. Every box holds ${map.name} Loot plus a bonus reward.`) {
          const description = `Sealed on the ${map.name}. Every box holds ${map.name} Loot plus a lucky drop: Credits, Cash or a Free unlock.`;
          await tx.update(s.mysteryBoxes).set({ description, updatedAt: new Date() }).where(eq(s.mysteryBoxes.id, box.id));
        }
        log(`${box.name} can now drop a Free unlock.`);
      }
    },
  },
  {
    id: "faq-no-odds",
    run: async (tx, log) => {
      const done = await tx.update(s.faqs).set({ answer: NEW_FAQ, updatedAt: new Date() }).where(eq(s.faqs.answer, OLD_FAQ)).returning({ id: s.faqs.id });
      log(done.length ? "FAQ no longer mentions odds." : "FAQ already edited, left as is.");
    },
  },
  {
    id: "maps-unlock-by-big-box",
    run: async (tx, log) => {
      for (const [i, m] of MAPS.entries()) {
        const level = i + 1;
        const done = await tx
          .update(s.items)
          .set({ purpose: lootPurpose(level, m.name), updatedAt: new Date() })
          .where(and(eq(s.items.kind, "LOOT"), eq(s.items.adventureLevel, level), eq(s.items.purpose, `Map ${level} Loot. Collect it to unlock ${m.name} and reach its checkpoints. Loot stays in your collection.`)))
          .returning({ id: s.items.id });
        if (done.length) log(`Map ${level} Loot no longer says it unlocks the map.`);
      }
    },
  },
  {
    id: "prize-puzzle-grids",
    run: async (tx, log) => {
      for (const [i, pieces] of PIECES_REQUIRED.entries()) {
        const level = i + 1;
        const done = await tx
          .update(s.puzzles)
          .set({ piecesRequired: pieces, updatedAt: new Date() })
          .where(and(eq(s.puzzles.level, level), eq(s.puzzles.piecesRequired, OLD_PIECES_REQUIRED[i])))
          .returning({ id: s.puzzles.id });
        if (done.length) log(`Level ${level} puzzle now needs ${pieces} pieces.`);
      }
      const [map10] = await tx.select({ id: s.maps.id }).from(s.maps).where(eq(s.maps.level, 10)).limit(1);
      if (!map10) return;
      const [o1, o2, o3] = bigBoxOdds(10);
      const done = await tx
        .update(s.bigMysteryBoxes)
        .set({ pieces1Pct: o1, pieces2Pct: o2, pieces3Pct: o3, version: sql`${s.bigMysteryBoxes.version} + 1`, updatedAt: new Date() })
        .where(and(eq(s.bigMysteryBoxes.mapId, map10.id), eq(s.bigMysteryBoxes.pieces1Pct, 30), eq(s.bigMysteryBoxes.pieces2Pct, 40), eq(s.bigMysteryBoxes.pieces3Pct, 30)))
        .returning({ id: s.bigMysteryBoxes.id });
      if (done.length) log("Map 10 Big Mystery Box now drops rarer pieces.");
    },
  },
  {
    id: "boxes-named-after-maps",
    run: async (tx, log) => {
      for (const [i, m] of MAPS.entries()) {
        const level = i + 1;
        const r = roman(level);
        const name = `${m.name} Box`;
        const now = new Date();
        const boxes = await tx
          .update(s.mysteryBoxes)
          .set({ name, updatedAt: now })
          .where(and(eq(s.mysteryBoxes.level, level), eq(s.mysteryBoxes.name, `Mystery Box ${r}`)))
          .returning({ id: s.mysteryBoxes.id });
        await tx
          .update(s.items)
          .set({ description: `Found in the ${name}.`, updatedAt: now })
          .where(and(eq(s.items.kind, "LOOT"), eq(s.items.adventureLevel, level), eq(s.items.description, `Found in Mystery Box ${r}.`)));
        await tx
          .update(s.rewardPools)
          .set({ name: `${name} Loot`, description: `Guaranteed Loot drop for every ${name}.`, updatedAt: now })
          .where(eq(s.rewardPools.name, `Mystery Box ${r} Loot`));
        await tx
          .update(s.rewardPools)
          .set({ name: `${name} Rewards`, description: `Lucky drop table for the ${name}: Credits, Cash or a Free unlock.`, updatedAt: now })
          .where(eq(s.rewardPools.name, `Mystery Box ${r} Rewards`));
        if (boxes.length) log(`Mystery Box ${r} is now the ${name}.`);
      }
    },
  },
];

const OLD_FAQ = "Yes. Every result is decided by our server using a cryptographically secure random number generator at the moment you play. Odds for each Mystery Box are published on the box page.";
const NEW_FAQ = "Yes. Every result is decided by our server using a cryptographically secure random number generator at the moment you play. Each Mystery Box shows the prizes you can win before you open it.";

/**
 * Brings already-seeded adventures in line with the current starting content. Each update runs
 * once, and only touches maps whose content still matches what the seed created, so admin edits
 * are never overwritten.
 */
export async function updateAdventureContent(log: (msg: string) => void = () => {}) {
  const key = "adventure_content_updates";
  for (const update of UPDATES) {
    const [row] = await db.select().from(s.appConfig).where(eq(s.appConfig.key, key));
    const applied = ((row?.value as { applied?: string[] } | undefined)?.applied ?? []) as string[];
    if (applied.includes(update.id)) {
      log(`Update ${update.id} already applied.`);
      continue;
    }
    await db.transaction(async (tx) => {
      await update.run(tx, (msg) => log(`${update.id}: ${msg}`));
      const value = { applied: [...applied, update.id], at: new Date().toISOString() };
      await tx.insert(s.appConfig).values({ key, value }).onConflictDoUpdate({ target: s.appConfig.key, set: { value } });
    });
  }
}
