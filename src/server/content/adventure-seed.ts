import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { roman } from "@/lib/adventure";

/**
 * Starting content for the 10-level adventure. Every number here is an example that admins
 * are expected to tune (prices, Loot thresholds, odds, prizes). Safe to run more than once.
 */
const MAPS = [
  { name: "Lost Shore", loot: 12, color: "#0ea5e9", items: [["Shore Shell", "shell"], ["Tide Pearl", "pearl"]], stops: ["Driftwood Camp", "Tide Caves", "Lighthouse Point", "Shipwreck Cove", "Coral Arch", "Hidden Lagoon"] },
  { name: "Hidden Jungle", loot: 16, color: "#16a34a", items: [["Jungle Relic", "leaf"], ["Jade Idol", "idol"]], stops: ["Explorer's Camp", "Vine Bridge", "Waterfall Pool", "Parrot Ridge", "Overgrown Shrine", "Heart of the Jungle"] },
  { name: "Ancient Ruins", loot: 20, color: "#a16207", items: [["Ancient Relic", "relic"], ["Carved Tablet", "scroll"]], stops: ["Broken Gate", "Sunken Courtyard", "Pillar Hall", "Scribe's Library", "Moon Stair", "Ancient Gate"] },
  { name: "Forgotten Temple", loot: 24, color: "#d97706", items: [["Temple Fragment", "fragment"], ["Ancient Key", "key"]], stops: ["Temple Steps", "Hall of Echoes", "Serpent Corridor", "Fire Altar", "Inner Sanctum", "Temple Vault"] },
  { name: "Crystal Caverns", loot: 28, color: "#7c3aed", items: [["Cave Crystal", "crystal"], ["Glow Shard", "shard"]], stops: ["Cavern Mouth", "Glowing Tunnel", "Echo Lake", "Crystal Garden", "Deep Chasm", "Crystal Throne"] },
  { name: "Golden Kingdom", loot: 32, color: "#ca8a04", items: [["Golden Coin", "coin"], ["Golden Idol", "crown"]], stops: ["Kingdom Road", "Market Square", "Royal Gardens", "Gilded Bridge", "Throne Hall", "Golden Treasury"] },
  { name: "Lost City", loot: 36, color: "#0f766e", items: [["City Seal", "seal"], ["Explorer's Compass", "compass"]], stops: ["City Outskirts", "Silent Plaza", "Old Aqueduct", "Observatory", "Palace Ruins", "City Heart"] },
  { name: "Sky Fortress", loot: 40, color: "#2563eb", items: [["Sky Feather", "feather"], ["Cloud Banner", "banner"]], stops: ["Cloud Stair", "Wind Gate", "Floating Garden", "Watchtower", "Storm Bridge", "Fortress Keep"] },
  { name: "Dragon's Realm", loot: 45, color: "#b91c1c", items: [["Dragon Scale", "scale"], ["Ember Stone", "ember"]], stops: ["Ash Fields", "Ember Pass", "Bone Canyon", "Lava Falls", "Dragon Gate", "Dragon's Hoard"] },
  { name: "Ultimate Treasure", loot: 50, color: "#be185d", items: [["Treasure Map Piece", "map"], ["Crown Jewel", "jewel"]], stops: ["Final Shore", "Treasure Gate", "Mirror Maze", "Hall of Kings", "Map Room", "Ultimate Treasure"] },
] as const;

const PRICES = [2000, 4000, 6000, 8000, 12000, 18000, 25000, 35000, 50000, 75000];
const LANDMARKS = ["tent", "compass", "mountain", "landmark", "castle", "treasure"];
/** Checkpoint positions (percent of the map art) that follow the trail drawn on each level's default illustration. */
const PATHS: [number, number][][] = [
  [[55, 90], [66, 72], [73, 52], [62, 35], [47, 22], [36, 8]],
  [[48, 92], [60, 70], [72, 54], [66, 38], [46, 22], [34, 8]],
  [[48, 88], [24, 64], [47, 52], [70, 46], [46, 32], [58, 10]],
  [[51, 92], [49, 71], [24, 52], [49, 42], [74, 30], [49, 13]],
  [[49, 86], [27, 63], [51, 48], [76, 40], [50, 24], [50, 12]],
  [[49, 86], [49, 62], [18, 52], [36, 36], [58, 28], [64, 14]],
  [[50, 92], [40, 67], [64, 52], [30, 32], [80, 30], [67, 17]],
  [[39, 92], [46, 76], [62, 58], [26, 46], [66, 34], [64, 18]],
  [[46, 92], [56, 72], [40, 54], [68, 46], [52, 30], [68, 10]],
  [[50, 94], [47, 80], [52, 60], [66, 40], [38, 30], [66, 16]],
];

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
const PIECES_REQUIRED = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2];

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
    const r = roman(level);
    const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const price = PRICES[i];
    const rmValue = price / 60;

    const lootIds: string[] = [];
    for (const [j, [name, icon]] of m.items.entries()) {
      const values = {
        name,
        icon,
        kind: "LOOT" as const,
        rarity: j === 0 ? ("UNCOMMON" as const) : ("RARE" as const),
        adventureLevel: level,
        purpose: `Map ${level} Loot. Collect it to unlock ${m.name} and reach its checkpoints. Loot stays in your collection.`,
        description: `Found in Mystery Box ${r}.`,
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
    const lootPool = await pool(`Mystery Box ${r} Loot`, [
      { label: `${base}× ${m.items[0][0]}`, rewardType: "ITEM", itemId: lootIds[0], amount: String(base), weight: 40, rarity: "UNCOMMON", reveal: { icon: m.items[0][1] } },
      { label: `${base + 1}× ${m.items[0][0]}`, rewardType: "ITEM", itemId: lootIds[0], amount: String(base + 1), weight: 32, rarity: "UNCOMMON", reveal: { icon: m.items[0][1] } },
      { label: `${base + 2}× ${m.items[0][0]}`, rewardType: "ITEM", itemId: lootIds[0], amount: String(base + 2), weight: 16, rarity: "UNCOMMON", reveal: { icon: m.items[0][1] } },
      { label: `${base + 2}× ${m.items[1][0]}`, rewardType: "ITEM", itemId: lootIds[1], amount: String(base + 2), weight: 12, rarity: "RARE", reveal: { icon: m.items[1][1] } },
    ], `Guaranteed Loot drop for every Mystery Box ${r}.`);
    const rewardPool = await pool(`Mystery Box ${r} Rewards`, [
      credits(Math.round(price * 0.25), 40, "COMMON"),
      credits(Math.round(price * 0.5), 30, "UNCOMMON"),
      credits(price, 12, "RARE"),
      credits(price * 2, 3, "EPIC"),
      cash(Math.max(1, Math.round(rmValue * 0.5)), 10, "UNCOMMON"),
      cash(Math.max(1, Math.round(rmValue * 1.5)), 4, "RARE"),
      cash(Math.max(1, Math.round(rmValue * 5)), 1, "LEGENDARY"),
    ], `Bonus reward table for Mystery Box ${r}.`);

    await db.insert(s.mysteryBoxes).values({
      slug: `mystery-box-${level}`,
      name: `Mystery Box ${r}`,
      description: `Sealed on the ${m.name}. Every box holds ${m.name} Loot plus a bonus reward.`,
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
    await db.insert(s.mapCheckpoints).values(
      m.stops.map((name, k) => {
        const isFinal = k === m.stops.length - 1;
        const [x, y] = PATHS[i][k];
        return {
          mapId: map.id,
          position: k + 1,
          name,
          description: isFinal ? "The final checkpoint. Something is hidden here." : `Checkpoint ${k + 1} on the ${m.name} route.`,
          landmark: LANDMARKS[k],
          lootRequired: isFinal ? m.loot + Math.ceil(m.loot * 1.25) : m.loot + Math.ceil(m.loot * 0.2 * (k + 1)),
          isFinal,
          posX: x,
          posY: y,
        };
      }),
    );
    const odds = level <= 5 ? [40, 40, 20] : [30, 40, 30];
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

  await db
    .insert(s.xpRules)
    .values([
      { source: "MAP_UNLOCK", label: "Unlock an adventure map", amount: 100 },
      { source: "CHECKPOINT_UNLOCK", label: "Discover a map checkpoint", amount: 40 },
      { source: "MAP_COMPLETE", label: "Complete an adventure map", amount: 250 },
    ])
    .onConflictDoNothing();
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
