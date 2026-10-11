/**
 * Mock players for demos: profiles with Loot and items, varied streaks and active Market
 * listings. Mock players have no login (no Neon Auth user); they exist so the leaderboard
 * and Market have real rows, and buying their listings runs the normal purchase flow.
 * Idempotent: guarded by the `mock_seed_version` app_config key. Ids start with `mock_`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { eq } from "drizzle-orm";

const PLAYERS: [string, string][] = [
  ["aiman", "Aiman Hakim"],
  ["siti", "Siti Nurhaliza Ahmad"],
  ["weijie", "Tan Wei Jie"],
  ["priya", "Priya Ramasamy"],
  ["hafiz", "Hafiz Iskandar"],
  ["meiyee", "Lim Mei Yee"],
  ["arjun", "Arjun Nair"],
  ["nurul", "Nurul Aina"],
  ["kahwai", "Wong Kah Wai"],
  ["farah", "Farah Diyana"],
  ["jasmine", "Jasmine Ong"],
  ["daniel", "Daniel Lee"],
  ["syafiq", "Syafiq Rahman"],
  ["kavitha", "Kavitha Subramaniam"],
  ["zulkifli", "Zulkifli Osman"],
  ["chloe", "Chloe Tan"],
  ["amirul", "Amirul Asyraf"],
  ["huiling", "Chong Hui Ling"],
  ["raj", "Rajesh Kumar"],
  ["aisyah", "Nur Aisyah"],
  ["jun", "Ng Jun Hao"],
  ["izzati", "Izzati Hamid"],
  ["marcus", "Marcus Yap"],
  ["deepa", "Deepa Menon"],
  ["haziq", "Haziq Zainal"],
  ["sarah", "Sarah Teoh"],
  ["faiz", "Faiz Kamarul"],
  ["yasmin", "Yasmin Azman"],
  ["kelvin", "Kelvin Chua"],
  ["alya", "Alya Batrisyia"],
];

const PRICE_BY_RARITY: Record<string, number> = { COMMON: 60, UNCOMMON: 180, RARE: 520, EPIC: 1600, LEGENDARY: 5200 };

/** Small deterministic PRNG so re-running on a fresh database gives the same data. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { ensureProfile } = await import("@/server/services/profiles");
  const { getConfig, getTimezone } = await import("@/server/services/config");
  const { addDays, appDay } = await import("@/lib/time");

  const [done] = await db.select().from(s.appConfig).where(eq(s.appConfig.key, "mock_seed_version"));
  if (done) {
    console.log("Mock data already seeded, skipping.");
    return;
  }

  const rand = rng(20261011);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const allItems = await db.select().from(s.items).where(eq(s.items.status, "PUBLISHED"));
  const loot = allItems.filter((i) => i.kind === "LOOT" && i.adventureLevel !== null);
  const extras = allItems.filter((i) => i.kind === "COLLECTIBLE" || i.kind === "SPECIAL" || i.kind === "FRAGMENT" || i.kind === "KEY");
  if (loot.length === 0) throw new Error("No published Loot items. Run npm run db:seed first.");
  const maxLevel = Math.max(...loot.map((i) => i.adventureLevel ?? 1));

  const market = await getConfig("market");
  const tz = await getTimezone();
  const today = appDay(new Date(), tz);
  const clampPrice = (p: number) => Math.min(market.maxPrice, Math.max(market.minPrice, Math.round(p)));

  console.log(`Creating ${PLAYERS.length} mock players...`);
  let listingsCreated = 0;
  for (const [i, [slug, name]] of PLAYERS.entries()) {
    const id = `mock_${slug}`;
    const email = `${slug}@mock.lootbox.my`;
    const profile = await ensureProfile({ id, email, name });
    const joined = new Date(Date.now() - int(3, 120) * 86_400_000);
    await db.update(s.profiles).set({ createdAt: joined, lastSeenAt: new Date(Date.now() - int(0, 72) * 3_600_000) }).where(eq(s.profiles.id, profile.id));

    // Earlier players in the list progress further so the leaderboard has a clear spread.
    const reach = Math.max(1, Math.min(maxLevel, Math.round(maxLevel * (1 - i / PLAYERS.length) * (0.7 + rand() * 0.5))));
    const holdings = new Map<string, { item: (typeof allItems)[number]; total: number }>();
    for (const it of loot.filter((l) => (l.adventureLevel ?? 1) <= reach)) {
      const lvl = it.adventureLevel ?? 1;
      const base = it.rarity === "RARE" ? int(2, 6) : int(6, 16);
      holdings.set(it.id, { item: it, total: base + Math.round(lvl * rand() * 3) });
    }
    for (let k = 0, n = int(1, 5); k < n && extras.length; k++) {
      const it = pick(extras);
      const prev = holdings.get(it.id);
      holdings.set(it.id, { item: it, total: (prev?.total ?? 0) + int(1, 3) });
    }

    const listingPlan: { itemId: string; qty: number; price: number; createdAt: Date }[] = [];
    const candidates = [...holdings.values()].filter((h) => h.total >= 2);
    for (let k = 0, n = int(0, 3); k < n && candidates.length; k++) {
      const h = candidates.splice(Math.floor(rand() * candidates.length), 1)[0];
      const qty = Math.max(1, Math.min(h.total - 1, int(1, 4)));
      const levelBoost = h.item.kind === "LOOT" ? 1 + (h.item.adventureLevel ?? 1) * 0.35 : 1;
      const price = clampPrice(PRICE_BY_RARITY[h.item.rarity] * levelBoost * (0.75 + rand() * 0.6));
      listingPlan.push({ itemId: h.item.id, qty, price, createdAt: new Date(Date.now() - int(0, 72) * 3_600_000 - int(0, 59) * 60_000) });
    }

    await db.transaction(async (tx) => {
      for (const { item, total } of holdings.values()) {
        const listed = listingPlan.filter((l) => l.itemId === item.id).reduce((n, l) => n + l.qty, 0);
        await tx.insert(s.inventory).values({ userId: id, itemId: item.id, quantity: total - listed, totalAcquired: total, firstAcquiredAt: joined }).onConflictDoNothing();
        await tx.insert(s.inventoryEvents).values({ userId: id, itemId: item.id, delta: total, reason: "Mock player starting collection", sourceType: "mock_seed", createdAt: joined });
      }
      for (const l of listingPlan) {
        const [row] = await tx
          .insert(s.marketListings)
          .values({ sellerId: id, itemId: l.itemId, listedQuantity: l.qty, quantity: l.qty, unitPrice: l.price, createdAt: l.createdAt, updatedAt: l.createdAt })
          .returning();
        await tx.insert(s.inventoryEvents).values({ userId: id, itemId: l.itemId, delta: -l.qty, reason: "Listed on the market", sourceType: "market_listing", sourceId: row.id, createdAt: l.createdAt });
        listingsCreated++;
      }

      const current = rand() < 0.15 ? 0 : Math.max(1, Math.round((PLAYERS.length - i) * 1.4 * rand()) + int(0, 6));
      const longest = current + int(0, 12);
      await tx
        .update(s.userStreaks)
        .set({ current, longest, lastClaimDay: current ? addDays(today, rand() < 0.6 ? 0 : -1) : addDays(today, -5), runStartDay: current ? addDays(today, -current + 1) : null })
        .where(eq(s.userStreaks.userId, id));
    });
    console.log(`  ${name.padEnd(24)} level ${reach}, ${holdings.size} item kinds, ${listingPlan.length} listings`);
  }

  await db.insert(s.appConfig).values({ key: "mock_seed_version", value: { version: 1, at: new Date().toISOString(), players: PLAYERS.length, listings: listingsCreated } });
  console.log(`Done: ${PLAYERS.length} players, ${listingsCreated} listings.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
