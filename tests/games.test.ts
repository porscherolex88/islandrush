import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { collectionCompletions, inventory, mysteryBoxPlays, rewardPoolEntries, tileDiscoveries } from "@/db/schema";
import { createAdjustment } from "@/server/services/admin-finance";
import { itemQuantity } from "@/server/services/inventory";
import { getBalances } from "@/server/services/ledger";
import { discoverTile, getMapState, unlockArea } from "@/server/services/map";
import { boxOdds, playMysteryBox } from "@/server/services/mystery-box";
import { getVaultStates, unlockVault } from "@/server/services/vault";
import { weightedPick } from "@/lib/rng";
import {
  addRequirement,
  admin,
  ensureAdminActor,
  makeArea,
  makeBox,
  makeCollection,
  makeItem,
  makeMap,
  makePool,
  makeTiles,
  makeUser,
  makeVault,
  seedMissions,
  seedProgression,
  setConfigRaw,
  uid,
} from "./helpers";

async function giveCredits(userId: string, amount: number) {
  await createAdjustment(admin, { userId, account: "CREDITS", direction: "CREDIT", amount: String(amount), reason: "Test credits", note: "", idempotencyKey: uid() });
}

beforeAll(async () => {
  await seedProgression();
  await seedMissions();
  await ensureAdminActor();
});

describe("weighted RNG", () => {
  it("never picks zero-weight entries and respects weights", () => {
    const entries = [
      { id: "a", weight: 0 },
      { id: "b", weight: 3 },
      { id: "c", weight: 1 },
    ];
    expect(weightedPick(entries, () => 0)?.id).toBe("b");
    expect(weightedPick(entries, () => 3)?.id).toBe("c");
    expect(weightedPick([{ id: "z", weight: 0 }])).toBeNull();
  });
});

describe("Mystery Box", () => {
  it("deducts Credits, determines the reward server-side and records the play", async () => {
    const pool = await makePool("WEIGHTED", [
      { label: "500 Credits", rewardType: "CREDITS", amount: "500", weight: 1 },
      { label: "Nothing weighted", rewardType: "CREDITS", amount: "1", weight: 0 },
    ]);
    const box = await makeBox(pool.id, 8000);
    const u = await makeUser();
    await giveCredits(u.id, 10000);
    const res = await playMysteryBox(u.id, { boxId: box.id, selectedIndex: 4, idempotencyKey: uid() });
    expect(res.reward.type).toBe("CREDITS");
    expect(res.reward.amount).toBe("500.00");
    expect(res.creditsSpent).toBe(8000);
    expect((await getBalances(u.id)).CREDITS).toBe(10000n - 8000n + 500n);
    const plays = await db.select().from(mysteryBoxPlays).where(eq(mysteryBoxPlays.userId, u.id));
    expect(plays).toHaveLength(1);
    expect(plays[0].selectedIndex).toBe(4);
  });

  it("rejects insufficient Credits without side effects", async () => {
    const pool = await makePool("WEIGHTED", [{ label: "x", rewardType: "CREDITS", amount: "1" }]);
    const box = await makeBox(pool.id, 8000);
    const u = await makeUser();
    await giveCredits(u.id, 7999);
    await expect(playMysteryBox(u.id, { boxId: box.id, selectedIndex: 0, idempotencyKey: uid() })).rejects.toThrow(/Not enough Credits/);
    expect((await getBalances(u.id)).CREDITS).toBe(7999n);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(mysteryBoxPlays).where(eq(mysteryBoxPlays.userId, u.id));
    expect(n).toBe(0);
  });

  it("is idempotent: a retried request never charges twice", async () => {
    const pool = await makePool("WEIGHTED", [{ label: "x", rewardType: "XP", amount: "5" }]);
    const box = await makeBox(pool.id, 1000);
    const u = await makeUser();
    await giveCredits(u.id, 5000);
    const key = uid();
    const [a, b] = await Promise.all([
      playMysteryBox(u.id, { boxId: box.id, selectedIndex: 1, idempotencyKey: key }),
      playMysteryBox(u.id, { boxId: box.id, selectedIndex: 1, idempotencyKey: key }),
    ]);
    expect(a.playId).toBe(b.playId);
    expect((await getBalances(u.id)).CREDITS).toBe(4000n);
  });

  it("validates the 3x3 selection and availability limits", async () => {
    const pool = await makePool("WEIGHTED", [{ label: "Rare", rewardType: "CREDITS", amount: "10", maxAwards: 1 }]);
    const box = await makeBox(pool.id, 100);
    const u = await makeUser();
    await giveCredits(u.id, 1000);
    await expect(playMysteryBox(u.id, { boxId: box.id, selectedIndex: 9, idempotencyKey: uid() })).rejects.toThrow(/nine/);
    await playMysteryBox(u.id, { boxId: box.id, selectedIndex: 0, idempotencyKey: uid() });
    await expect(playMysteryBox(u.id, { boxId: box.id, selectedIndex: 0, idempotencyKey: uid() })).rejects.toThrow(/unavailable/);
    expect((await getBalances(u.id)).CREDITS).toBe(1000n - 100n + 10n);
    const [entry] = await db.select().from(rewardPoolEntries).where(eq(rewardPoolEntries.poolId, pool.id));
    expect(entry.awardedCount).toBe(1);
  });

  it("publishes odds that sum to 100%", async () => {
    const pool = await makePool("WEIGHTED", [{ weight: 1 }, { weight: 3 }]);
    const odds = await boxOdds(pool.id);
    expect(odds.reduce((s, o) => s + o.pct, 0)).toBeCloseTo(100);
  });

  it("awards cash rewards into Pending Rewards, never directly Withdrawable", async () => {
    const pool = await makePool("WEIGHTED", [{ label: "RM150", rewardType: "CASH", amount: "150.00" }]);
    const box = await makeBox(pool.id, 8000);
    const u = await makeUser();
    await giveCredits(u.id, 8000);
    await playMysteryBox(u.id, { boxId: box.id, selectedIndex: 2, idempotencyKey: uid() });
    const b = await getBalances(u.id);
    expect(b.PENDING_REWARDS).toBe(15000n);
    expect(b.WITHDRAWABLE).toBe(0n);
  });
});

describe("Mystery Map, Special Areas, collections and Vault", () => {
  it("runs the full progression loop", async () => {
    await setConfigRaw("daily_defaults", { freeDiscoveries: 1 });
    const col = await makeCollection("Relics");
    const compass = await makeItem({ name: "Ancient Compass", kind: "SPECIAL", collectionId: col.id });
    const idol = await makeItem({ name: "Emerald Idol", kind: "COLLECTIBLE", collectionId: col.id });
    const templeKey = await makeItem({ name: "Temple Key", kind: "KEY" });
    const ancientMap = await makeItem({ name: "Ancient Map", kind: "SPECIAL", fragmentsRequired: 2 });
    const mapFragment = await makeItem({ name: "Map Fragment", kind: "FRAGMENT", assemblesIntoItemId: ancientMap.id, autoAssemble: true });

    const map = await makeMap();
    const beachPool = await makePool("ALL", [
      { label: "Compass", rewardType: "ITEM", itemId: compass.id, amount: "1" },
      { label: "Fragment", rewardType: "ITEM", itemId: mapFragment.id, amount: "1" },
    ]);
    const beach = await makeArea(map.id, { name: "Beach", discoveryCostCredits: 1000, discoveryPoolId: null, sortOrder: 0 });
    const [t1, t2, t3] = await makeTiles(beach.id, 3);
    const weighted = await makePool("WEIGHTED", [{ label: "Compass", rewardType: "ITEM", itemId: compass.id }]);
    const fragPool = await makePool("WEIGHTED", [{ label: "Fragment", rewardType: "ITEM", itemId: mapFragment.id }]);
    const idolPool = await makePool("WEIGHTED", [{ label: "Idol", rewardType: "ITEM", itemId: idol.id }]);
    const keyPool = await makePool("WEIGHTED", [{ label: "Key", rewardType: "ITEM", itemId: templeKey.id }]);
    await db.execute(sql`update map_tiles set discovery_pool_id = ${weighted.id} where id = ${t1.id}`);
    await db.execute(sql`update map_tiles set discovery_pool_id = ${fragPool.id} where id = ${t2.id}`);
    await db.execute(sql`update map_tiles set discovery_pool_id = ${fragPool.id} where id = ${t3.id}`);
    void beachPool;

    const temple = await makeArea(map.id, { name: "Temple", isSpecial: true, discoveryCostCredits: 0, discoveryPoolId: idolPool.id, sortOrder: 1 });
    const [templeTile] = await makeTiles(temple.id, 1);
    await addRequirement({ ownerType: "AREA", ownerId: temple.id, type: "ITEM", itemId: templeKey.id, quantity: 1, consume: true, label: "Temple Key" });
    await addRequirement({ ownerType: "AREA", ownerId: temple.id, type: "ITEM", itemId: ancientMap.id, quantity: 1, label: "Ancient Map" });
    await addRequirement({ ownerType: "AREA", ownerId: temple.id, type: "COLLECTION_PROGRESS", collectionId: col.id, quantity: 1, label: "Relics 1/2" });

    const vaultPool = await makePool("ALL", [{ label: "Vault Credits", rewardType: "CREDITS", amount: "25000" }]);
    const vault = await makeVault(vaultPool.id);
    await addRequirement({ ownerType: "VAULT", ownerId: vault.id, type: "COLLECTION_COMPLETE", collectionId: col.id, label: "Relics complete" });
    await addRequirement({ ownerType: "VAULT", ownerId: vault.id, type: "AREA_UNLOCKED", areaId: temple.id, label: "Temple opened" });

    const u = await makeUser();
    await giveCredits(u.id, 2000);

    // First discovery uses the daily free discovery; next ones cost Credits.
    const d1 = await discoverTile(u.id, t1.id);
    expect(d1.usedFreeDiscovery).toBe(true);
    expect(d1.reward.itemName).toBe("Ancient Compass");
    const replay = await discoverTile(u.id, t1.id);
    expect(replay.replayed).toBe(true);
    await discoverTile(u.id, t2.id);
    await discoverTile(u.id, t3.id);
    expect((await getBalances(u.id)).CREDITS).toBe(0n);
    await expect(discoverTile(u.id, templeTile.id)).rejects.toThrow(/locked/);

    // Fragments auto-assembled into the Ancient Map.
    expect(await itemQuantity(db, u.id, ancientMap.id)).toBe(1);
    expect(await itemQuantity(db, u.id, mapFragment.id)).toBe(0);

    let state = await getMapState(u.id, map.id);
    const templeView = state!.areas.find((a) => a.id === temple.id)!;
    expect(templeView.canUnlock).toBe(false);
    expect(templeView.requirements.find((r) => r.label === "Temple Key")?.met).toBe(false);
    await expect(unlockArea(u.id, temple.id)).rejects.toThrow(/requirements/);

    // Get the key (e.g. from a Daily Spin) then unlock.
    await db.transaction(async (tx) => {
      const { grantPool } = await import("@/server/services/rewards");
      await grantPool(tx, u.id, keyPool.id, { sourceType: "test", sourceId: "k", key: uid() });
    });
    const unlocked = await unlockArea(u.id, temple.id);
    expect(unlocked.area.id).toBe(temple.id);
    expect(await itemQuantity(db, u.id, templeKey.id)).toBe(0); // consumed
    await expect(unlockArea(u.id, temple.id)).rejects.toThrow();

    state = await getMapState(u.id, map.id);
    expect(state!.areas.find((a) => a.id === temple.id)!.accessible).toBe(true);

    let vaults = await getVaultStates(u.id);
    expect(vaults.find((v) => v.id === vault.id)!.ready).toBe(false);
    await expect(unlockVault(u.id, vault.id)).rejects.toThrow(/not complete/);

    // Discover the Emerald Idol: completes the collection.
    await discoverTile(u.id, templeTile.id);
    const [done] = await db
      .select()
      .from(collectionCompletions)
      .where(and(eq(collectionCompletions.userId, u.id), eq(collectionCompletions.collectionId, col.id)));
    expect(done).toBeTruthy();

    vaults = await getVaultStates(u.id);
    expect(vaults.find((v) => v.id === vault.id)!.ready).toBe(true);
    const opened = await unlockVault(u.id, vault.id);
    expect(opened.rewards[0].type).toBe("CREDITS");
    expect((await getBalances(u.id)).CREDITS).toBe(25000n);
    await expect(unlockVault(u.id, vault.id)).rejects.toThrow(/already/);

    const inv = await db.select().from(inventory).where(eq(inventory.userId, u.id));
    expect(inv.find((i) => i.itemId === compass.id)?.quantity).toBe(1);
    const discoveries = await db.select().from(tileDiscoveries).where(eq(tileDiscoveries.userId, u.id));
    expect(discoveries).toHaveLength(4);
  });
});
