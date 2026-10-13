/* eslint-disable no-console */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { and, eq } from "drizzle-orm";

async function main() {
  const { db } = await import("@/db");
  const s = await import("@/db/schema");
  const { CONFIG_DEFAULTS, CONFIG_DESCRIPTIONS } = await import("@/server/services/config");
  const { ensureProfile } = await import("@/server/services/profiles");
  const { approveDeposit, createDeposit } = await import("@/server/services/deposits");
  const { convertCashToCredits } = await import("@/server/services/conversion");
  const { createCashReward } = await import("@/server/services/rewards");
  const { settleDueRewards } = await import("@/server/services/cash-rewards");
  const { discoverTile } = await import("@/server/services/map");
  const { playMysteryBox } = await import("@/server/services/mystery-box");
  const { addWithdrawalAccount } = await import("@/server/services/withdrawals");
  const { createTicket } = await import("@/server/services/support");
  const { DEFAULT_ROLE_PERMISSIONS } = await import("@/lib/permissions");
  const { addDays, appDay } = await import("@/lib/time");

  const [seeded] = await db.select().from(s.appConfig).where(eq(s.appConfig.key, "seed_version"));
  const contentSeeded = Boolean(seeded);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  const itemIds: Record<string, string> = {};
  const item = async (slug: string, v: Omit<typeof s.items.$inferInsert, "slug">) => {
    const [row] = await db.insert(s.items).values({ slug, ...v }).onConflictDoUpdate({ target: s.items.slug, set: { ...v, updatedAt: new Date() } }).returning();
    itemIds[slug] = row.id;
    return row;
  };
  type E = Omit<typeof s.rewardPoolEntries.$inferInsert, "poolId">;
  const pool = async (name: string, mode: "WEIGHTED" | "ALL", entries: E[], description = "") => {
    const [p] = await db.insert(s.rewardPools).values({ name, mode, description }).returning();
    await db.insert(s.rewardPoolEntries).values(entries.map((e, i) => ({ ...e, poolId: p.id, sortOrder: i })));
    return p;
  };
  const credits = (amount: number, weight: number, rarity: E["rarity"] = "COMMON"): E => ({
    label: `${amount.toLocaleString()} Credits`,
    rewardType: "CREDITS",
    amount: String(amount),
    weight,
    rarity,
  });
  const cash = (amount: string, weight: number, rarity: E["rarity"] = "RARE"): E => ({ label: `RM${amount} reward`, rewardType: "CASH", amount, weight, rarity });
  const give = (slug: string, weight: number, qty = 1, label?: string): E => ({
    label: label ?? slug,
    rewardType: "ITEM",
    itemId: itemIds[slug],
    amount: String(qty),
    weight,
    rarity: "COMMON",
  });

  if (!contentSeeded) {
    console.log("Seeding content...");

    /* Collections & items ------------------------------------------------ */
    const [relics] = await db
      .insert(s.collections)
      .values({ slug: "lost-island-relics", name: "Lost Island Relics", description: "Ten relics scattered across the Lost Island. Collect them to open the Temple.", icon: "🏝️", color: "#0ea5e9", sortOrder: 0 })
      .returning();
    const [treasures] = await db
      .insert(s.collections)
      .values({ slug: "temple-treasures", name: "Temple Treasures", description: "Five treasures hidden inside the Temple. Complete this set to reach the Ancient Vault.", icon: "🛕", color: "#f59e0b", sortOrder: 1 })
      .returning();

    await item("explorer-hat", { name: "Explorer's Hat", icon: "🤠", kind: "COSMETIC", rarity: "EPIC", purpose: "Profile cosmetic shown on your Account page.", description: "Awarded for completing Lost Island Relics." });
    await item("ancient-map", { name: "Ancient Map", icon: "🗺️", kind: "SPECIAL", rarity: "EPIC", purpose: "Relic in Lost Island Relics and a requirement to unlock the Temple.", description: "Pieced together from five fragments.", collectionId: relics.id, fragmentsRequired: 5, sortOrder: 9 });
    await item("map-fragment", { name: "Ancient Map Fragment", icon: "📜", kind: "FRAGMENT", rarity: "UNCOMMON", purpose: "Five fragments automatically assemble into the Ancient Map.", assemblesIntoItemId: itemIds["ancient-map"], autoAssemble: true });
    await item("seal-fragment", { name: "Vault Seal Fragment", icon: "🔶", kind: "FRAGMENT", rarity: "RARE", purpose: "Eight are required (and consumed) to break the Ancient Vault seal." });
    await item("temple-key", { name: "Temple Key", icon: "🗝️", kind: "KEY", rarity: "RARE", purpose: "Consumed to unlock the Temple Special Area." });
    await item("vault-key", { name: "Vault Key", icon: "🔑", kind: "KEY", rarity: "EPIC", purpose: "Three are required (and consumed) to open the Ancient Vault." });

    const relicItems: [string, string, string, typeof s.items.$inferInsert.rarity, typeof s.items.$inferInsert.kind][] = [
      ["seashell-charm", "Seashell Charm", "🐚", "COMMON", "COLLECTIBLE"],
      ["golden-coin", "Golden Coin", "🪙", "COMMON", "SPECIAL"],
      ["pirate-spyglass", "Pirate Spyglass", "🔭", "UNCOMMON", "COLLECTIBLE"],
      ["ancient-compass", "Ancient Compass", "🧭", "UNCOMMON", "SPECIAL"],
      ["explorers-scroll", "Explorer's Scroll", "📃", "UNCOMMON", "SPECIAL"],
      ["jade-mask", "Jade Mask", "🎭", "RARE", "COLLECTIBLE"],
      ["emerald-idol", "Emerald Idol", "🗿", "RARE", "SPECIAL"],
      ["coral-crown", "Coral Crown", "👑", "EPIC", "COLLECTIBLE"],
      ["sun-medallion", "Sun Medallion", "🌞", "EPIC", "COLLECTIBLE"],
    ];
    for (const [i, [slug, name, icon, rarity, kind]] of relicItems.entries()) {
      await item(slug, { name, icon, rarity, kind, collectionId: relics.id, sortOrder: i, purpose: `Relic ${i + 1} of 10 in Lost Island Relics. Counts toward the Temple unlock (8/10).` });
    }
    const treasureItems: [string, string, string, typeof s.items.$inferInsert.rarity][] = [
      ["golden-scarab", "Golden Scarab", "🪲", "UNCOMMON"],
      ["obsidian-blade", "Obsidian Blade", "🗡️", "RARE"],
      ["ruby-chalice", "Ruby Chalice", "🏆", "RARE"],
      ["moonstone", "Moonstone", "🌙", "EPIC"],
      ["serpent-totem", "Serpent Totem", "🐍", "LEGENDARY"],
    ];
    for (const [i, [slug, name, icon, rarity]] of treasureItems.entries()) {
      await item(slug, { name, icon, rarity, kind: "COLLECTIBLE", collectionId: treasures.id, sortOrder: i, purpose: "Temple Treasure. Completing the set satisfies the Ancient Vault collection requirement." });
    }

    const relicsReward = await pool("Lost Island Relics completion", "ALL", [credits(10000, 1, "EPIC"), give("explorer-hat", 1, 1, "Explorer's Hat cosmetic"), give("vault-key", 1, 1, "Vault Key")]);
    const treasuresReward = await pool("Temple Treasures completion", "ALL", [credits(20000, 1, "EPIC"), give("vault-key", 1, 1, "Vault Key")]);
    await db.update(s.collections).set({ completionRewardPoolId: relicsReward.id }).where(eq(s.collections.id, relics.id));
    await db.update(s.collections).set({ completionRewardPoolId: treasuresReward.id }).where(eq(s.collections.id, treasures.id));

    /* Mystery Boxes ------------------------------------------------------- */
    const islandBoxPool = await pool("Island Mystery Box", "WEIGHTED", [
      credits(3000, 260),
      credits(6000, 200, "UNCOMMON"),
      credits(12000, 70, "RARE"),
      cash("50.00", 80, "UNCOMMON"),
      cash("150.00", 30, "RARE"),
      cash("500.00", 5, "LEGENDARY"),
      give("golden-coin", 90, 1, "Golden Coin"),
      give("explorers-scroll", 60, 1, "Explorer's Scroll"),
      give("map-fragment", 90, 1, "Ancient Map Fragment"),
      give("seal-fragment", 50, 1, "Vault Seal Fragment"),
      give("vault-key", 15, 1, "Vault Key"),
    ]);
    for (const e of await db.select().from(s.rewardPoolEntries).where(eq(s.rewardPoolEntries.poolId, islandBoxPool.id))) {
      if (e.rewardType === "ITEM") {
        const [it] = await db.select().from(s.items).where(eq(s.items.id, e.itemId!));
        await db.update(s.rewardPoolEntries).set({ rarity: it.rarity, reveal: { icon: it.icon } }).where(eq(s.rewardPoolEntries.id, e.id));
      }
    }
    await db.insert(s.mysteryBoxes).values({
      slug: "island-box",
      name: "Island Mystery Box",
      description: "Nine sealed crates washed ashore. Choose one and see what the tide brought in.",
      priceCredits: 8000,
      rewardPoolId: islandBoxPool.id,
      theme: { color: "#7c3aed", accent: "#f59e0b" },
      sortOrder: 0,
    });
    const starterPool = await pool("Starter Mystery Box", "WEIGHTED", [
      credits(800, 300),
      credits(1500, 200, "UNCOMMON"),
      credits(4000, 40, "RARE"),
      cash("10.00", 40, "UNCOMMON"),
      give("seashell-charm", 150, 1, "Seashell Charm"),
      give("map-fragment", 120, 1, "Ancient Map Fragment"),
    ]);
    await db.insert(s.mysteryBoxes).values({
      slug: "starter-box",
      name: "Starter Mystery Box",
      description: "A lighter crate for new explorers.",
      priceCredits: 2000,
      rewardPoolId: starterPool.id,
      theme: { color: "#0ea5e9", accent: "#22c55e" },
      sortOrder: 1,
    });

    /* Map ----------------------------------------------------------------- */
    const [map] = await db.insert(s.maps).values({ slug: "lost-island", name: "Lost Island", description: "A permanent island world. Explore every area and reach the Ancient Vault." }).returning();
    const beachPool = await pool("Beach discoveries", "WEIGHTED", [credits(500, 30), credits(1500, 15, "UNCOMMON"), give("seashell-charm", 14, 1, "Seashell Charm"), give("golden-coin", 10, 1, "Golden Coin"), give("pirate-spyglass", 7, 1, "Pirate Spyglass"), give("map-fragment", 14, 1, "Ancient Map Fragment")]);
    const junglePool = await pool("Jungle discoveries", "WEIGHTED", [credits(1000, 25), credits(3000, 10, "UNCOMMON"), give("explorers-scroll", 12, 1, "Explorer's Scroll"), give("ancient-compass", 10, 1, "Ancient Compass"), give("jade-mask", 6, 1, "Jade Mask"), give("map-fragment", 14, 1, "Ancient Map Fragment"), give("temple-key", 5, 1, "Temple Key"), cash("20.00", 4)]);
    const ruinsPool = await pool("Ancient Ruins discoveries", "WEIGHTED", [credits(2000, 20), give("emerald-idol", 10, 1, "Emerald Idol"), give("coral-crown", 6, 1, "Coral Crown"), give("sun-medallion", 6, 1, "Sun Medallion"), give("seal-fragment", 14, 1, "Vault Seal Fragment"), give("temple-key", 8, 1, "Temple Key"), cash("50.00", 4)]);
    const templePool = await pool("Temple discoveries", "WEIGHTED", [give("golden-scarab", 14, 1, "Golden Scarab"), give("obsidian-blade", 11, 1, "Obsidian Blade"), give("ruby-chalice", 11, 1, "Ruby Chalice"), give("moonstone", 8, 1, "Moonstone"), give("serpent-totem", 5, 1, "Serpent Totem"), give("seal-fragment", 14, 1, "Vault Seal Fragment"), give("vault-key", 6, 1, "Vault Key"), cash("100.00", 3, "EPIC")]);
    const templeUnlockReward = await pool("Temple unlock reward", "ALL", [credits(5000, 1, "RARE")]);

    const area = async (v: Omit<typeof s.mapAreas.$inferInsert, "mapId">, tiles: string[]) => {
      const [a] = await db.insert(s.mapAreas).values({ ...v, mapId: map.id }).returning();
      await db.insert(s.mapTiles).values(tiles.map((icon, i) => ({ areaId: a.id, row: Math.floor(i / a.gridCols), col: i % a.gridCols, name: `${a.name} ${i + 1}`, icon })));
      return a;
    };
    const beach = await area({ slug: "beach", name: "Beach", icon: "🏖️", color: "#f59e0b", description: "Warm sand, tide pools and whatever the sea left behind.", discoveryCostCredits: 1000, discoveryPoolId: beachPool.id, sortOrder: 0, gridCols: 4, gridRows: 3 }, Array(12).fill("🌊"));
    const jungle = await area({ slug: "jungle", name: "Jungle", icon: "🌴", color: "#16a34a", description: "Dense canopy hiding old explorer camps.", discoveryCostCredits: 1500, discoveryPoolId: junglePool.id, sortOrder: 1, gridCols: 4, gridRows: 3 }, Array(12).fill("🌿"));
    const ruins = await area({ slug: "ancient-ruins", name: "Ancient Ruins", icon: "🏛️", color: "#78716c", description: "Crumbling stone with carvings that point to the Vault.", discoveryCostCredits: 2000, discoveryPoolId: ruinsPool.id, sortOrder: 2, gridCols: 4, gridRows: 3 }, Array(12).fill("🪨"));
    const temple = await area({ slug: "temple", name: "Temple", icon: "🛕", color: "#d97706", isSpecial: true, description: "A sealed Special Area. Its treasures lead to the Ancient Vault.", discoveryCostCredits: 2500, discoveryPoolId: templePool.id, unlockRewardPoolId: templeUnlockReward.id, sortOrder: 3, gridCols: 4, gridRows: 2 }, Array(8).fill("✨"));

    await db.insert(s.requirements).values([
      { ownerType: "AREA", ownerId: jungle.id, type: "AREA_TILES", areaId: beach.id, quantity: 6, label: "Discover 6 Beach tiles", sortOrder: 0 },
      { ownerType: "AREA", ownerId: ruins.id, type: "AREA_TILES", areaId: jungle.id, quantity: 6, label: "Discover 6 Jungle tiles", sortOrder: 0 },
      { ownerType: "AREA", ownerId: temple.id, type: "ITEM", itemId: itemIds["temple-key"], quantity: 1, consume: true, label: "Temple Key", sortOrder: 0 },
      { ownerType: "AREA", ownerId: temple.id, type: "ITEM", itemId: itemIds["ancient-map"], quantity: 1, label: "Ancient Map", sortOrder: 1 },
      { ownerType: "AREA", ownerId: temple.id, type: "COLLECTION_PROGRESS", collectionId: relics.id, quantity: 8, label: "Lost Island Relics", sortOrder: 2 },
    ]);

    /* Vault --------------------------------------------------------------- */
    const vaultReward = await pool("Ancient Vault reward", "ALL", [cash("1000.00", 1, "LEGENDARY"), credits(60000, 1, "LEGENDARY")]);
    const [vault] = await db
      .insert(s.vaults)
      .values({ slug: "ancient-vault", name: "Ancient Vault", icon: "🏛️", mapId: map.id, rewardPoolId: vaultReward.id, description: "The island's greatest secret. Gather keys, seal fragments and the Temple Treasures to break it open." })
      .returning();
    await db.insert(s.requirements).values([
      { ownerType: "VAULT", ownerId: vault.id, type: "ITEM", itemId: itemIds["vault-key"], quantity: 3, consume: true, label: "Vault Keys", sortOrder: 0 },
      { ownerType: "VAULT", ownerId: vault.id, type: "ITEM", itemId: itemIds["seal-fragment"], quantity: 8, consume: true, label: "Seal Fragments", sortOrder: 1 },
      { ownerType: "VAULT", ownerId: vault.id, type: "COLLECTION_COMPLETE", collectionId: treasures.id, quantity: 1, label: "Temple Treasures", sortOrder: 2 },
    ]);

    /* Daily ---------------------------------------------------------------- */
    const spinPool = await pool("Daily Spin", "WEIGHTED", [credits(200, 30), credits(500, 22), credits(1000, 12, "UNCOMMON"), give("map-fragment", 8, 1, "Ancient Map Fragment"), give("seal-fragment", 5, 1, "Vault Seal Fragment"), give("temple-key", 2, 1, "Temple Key"), cash("5.00", 6, "UNCOMMON")]);
    const streakSpinPool = await pool("Daily Spin (7+ day streak)", "WEIGHTED", [credits(500, 25), credits(1500, 20, "UNCOMMON"), credits(3000, 8, "RARE"), give("map-fragment", 10, 1, "Ancient Map Fragment"), give("seal-fragment", 8, 1, "Vault Seal Fragment"), give("temple-key", 4, 1, "Temple Key"), give("vault-key", 2, 1, "Vault Key"), cash("10.00", 8, "UNCOMMON")]);
    const bonusPool = await pool("Daily missions bonus", "ALL", [credits(2000, 1, "UNCOMMON")]);
    const eventPool = await pool("Daily Mystery Event", "WEIGHTED", [credits(800, 30), give("map-fragment", 20, 1, "Ancient Map Fragment"), give("seal-fragment", 12, 1, "Vault Seal Fragment"), give("golden-coin", 15, 1, "Golden Coin")]);

    await db.insert(s.missionDefinitions).values([
      { key: "daily_login", title: "Check in today", action: "DAILY_LOGIN", target: 1, icon: "👋" },
      { key: "open_box", title: "Open 1 Mystery Box", action: "OPEN_BOX", target: 1, icon: "🎁" },
      { key: "discover_2", title: "Discover 2 Map Tiles", action: "DISCOVER_TILE", target: 2, icon: "🧭" },
      { key: "spin", title: "Complete Daily Spin", action: "DAILY_SPIN", target: 1, icon: "🎡" },
      { key: "event", title: "Explore the Daily Mystery Event", action: "DAILY_EVENT", target: 1, icon: "🌊" },
      { key: "collect_3", title: "Collect 3 items", action: "COLLECT_ITEM", target: 3, icon: "🎒" },
      { key: "convert", title: "Convert Cash to Credits", action: "CONVERT_CREDITS", target: 1, icon: "🔁", active: true },
      { key: "unlock_area", title: "Unlock a new area", action: "UNLOCK_AREA", target: 1, icon: "🔓" },
    ]);

    const ms = async (days: number, title: string, entries: E[]) => {
      const p = await pool(`Streak ${days} days`, "ALL", entries);
      await db.insert(s.streakMilestones).values({ days, title, rewardPoolId: p.id });
    };
    await ms(3, "Warming up", [credits(1000, 1)]);
    await ms(7, "One week strong", [credits(3000, 1, "UNCOMMON"), give("vault-key", 1, 1, "Vault Key")]);

    const today = appDay(new Date(), CONFIG_DEFAULTS.timezone);
    await db.insert(s.dailySchedules).values({
      day: addDays(today, 1),
      status: "PUBLISHED",
      eventTitle: "Shipwreck Cove",
      eventDescription: "A storm uncovered an old shipwreck overnight. What's inside the captain's chest?",
      eventIcon: "⚓",
      eventPoolId: eventPool.id,
      freeDiscoveries: 4,
    });

    /* Config ---------------------------------------------------------------- */
    const configValues = {
      ...CONFIG_DEFAULTS,
      daily_defaults: {
        ...CONFIG_DEFAULTS.daily_defaults,
        spinPoolId: spinPool.id,
        missionBonusPoolId: bonusPool.id,
        eventPoolId: eventPool.id,
        missionKeys: ["daily_login", "open_box", "discover_2", "spin", "event", "collect_3"],
        streakSpinPoolId: streakSpinPool.id,
      },
    };
    for (const [key, value] of Object.entries(configValues)) {
      await db
        .insert(s.appConfig)
        .values({ key, value: value as object, description: CONFIG_DESCRIPTIONS[key as keyof typeof CONFIG_DESCRIPTIONS] })
        .onConflictDoNothing();
    }
    await db.insert(s.featureFlags).values([
      { key: "mystery_box", enabled: true, description: "Mystery Box game" },
      { key: "mystery_map", enabled: true, description: "Mystery Map game" },
      { key: "vault", enabled: true, description: "Vault" },
      { key: "daily_spin", enabled: true, description: "Daily Spin" },
      { key: "referrals", enabled: true, description: "Referral program" },
      { key: "deposits", enabled: true, description: "Manual deposits" },
      { key: "withdrawals", enabled: true, description: "Withdrawals" },
      { key: "registrations", enabled: true, description: "New account registration" },
    ]).onConflictDoNothing();

    /* Progression ---------------------------------------------------------- */
    await db.insert(s.depositLevels).values([
      { name: "Starter", sortOrder: 0, threshold: "0", color: "#94a3b8", benefits: ["Full access to all games", "Daily Spin and missions"], withdrawalMaxDaily: "2000.00" },
      { name: "Bronze", sortOrder: 1, threshold: "500", color: "#b45309", benefits: ["Higher daily withdrawal limit"], withdrawalMaxDaily: "5000.00" },
      { name: "Silver", sortOrder: 2, threshold: "2000", color: "#64748b", benefits: ["Priority deposit review"], withdrawalMaxDaily: "10000.00" },
      { name: "Gold", sortOrder: 3, threshold: "5000", color: "#ca8a04", benefits: ["Priority withdrawals"], withdrawalMaxDaily: "20000.00" },
      { name: "Platinum", sortOrder: 4, threshold: "15000", color: "#0891b2", benefits: ["Dedicated support queue"], withdrawalMaxDaily: "50000.00" },
      { name: "Diamond", sortOrder: 5, threshold: "50000", color: "#7c3aed", benefits: ["Personal account manager"], withdrawalMaxDaily: "100000.00" },
      { name: "Elite", sortOrder: 6, threshold: "150000", color: "#111827", benefits: ["Invitation-only events"], withdrawalMaxDaily: "250000.00" },
    ]);
    const achPool = async (amount: number) => (await pool(`Achievement ${amount} Credits`, "ALL", [credits(amount, 1, "UNCOMMON")])).id;
    await db.insert(s.achievements).values([
      { key: "first_box", name: "First Crate", description: "Open your first Mystery Box", condition: "BOXES_OPENED", threshold: 1, badgeName: "Crate Cracker", badgeIcon: "📦" },
      { key: "box_25", name: "Crate Connoisseur", description: "Open 25 Mystery Boxes", condition: "BOXES_OPENED", threshold: 25, badgeName: "Connoisseur", badgeIcon: "🎁", rewardPoolId: await achPool(2000) },
      { key: "tiles_10", name: "Trailblazer", description: "Discover 10 map tiles", condition: "TILES_DISCOVERED", threshold: 10, badgeName: "Trailblazer", badgeIcon: "🥾", rewardPoolId: await achPool(1000) },
      { key: "tiles_40", name: "Cartographer", description: "Discover 40 map tiles", condition: "TILES_DISCOVERED", threshold: 40, badgeName: "Cartographer", badgeIcon: "🗺️", rewardPoolId: await achPool(5000) },
      { key: "area_1", name: "Gatekeeper", description: "Unlock your first area", condition: "AREAS_UNLOCKED", threshold: 1, badgeName: "Gatekeeper", badgeIcon: "🚪" },
      { key: "collection_1", name: "Curator", description: "Complete a collection", condition: "COLLECTIONS_COMPLETED", threshold: 1, badgeName: "Curator", badgeIcon: "🏺" },
      { key: "vault_1", name: "Vault Breaker", description: "Open a Vault", condition: "VAULTS_UNLOCKED", threshold: 1, badgeName: "Vault Breaker", badgeIcon: "🏛️" },
      { key: "streak_7", name: "On Fire", description: "Reach a 7-day streak", condition: "STREAK_DAYS", threshold: 7, badgeName: "On Fire", badgeIcon: "🔥" },
      { key: "streak_30", name: "Devoted", description: "Reach a 30-day streak", condition: "STREAK_DAYS", threshold: 30, badgeName: "Devoted", badgeIcon: "💎" },
      { key: "items_15", name: "Hoarder", description: "Collect 15 different items", condition: "ITEMS_COLLECTED", threshold: 15, badgeName: "Hoarder", badgeIcon: "🎒" },
    ]);

    /* Referrals, payments, RBAC ------------------------------------------ */
    await db.insert(s.referralLevels).values([
      { level: 1, rewardKind: "FIXED", value: "30.00" },
      { level: 2, rewardKind: "PERCENT", value: "2.00" },
      { level: 3, rewardKind: "FIXED", value: "5.00" },
    ]);
    await db.insert(s.paymentAccounts).values([
      { bankName: "Maybank", accountName: "LootBox Rewards Sdn Bhd", accountNumber: "5140 1234 5678", instructions: "Use the transfer reference shown on this page so we can match your deposit.", sortOrder: 0 },
      { bankName: "CIMB Bank", accountName: "LootBox Rewards Sdn Bhd", accountNumber: "8009 876 543", instructions: "DuitNow transfers are usually reviewed within 30 minutes.", sortOrder: 1 },
    ]);
    for (const role of ["SUPPORT", "FINANCE", "GAME_ADMIN"] as const) {
      await db.insert(s.rolePermissions).values(DEFAULT_ROLE_PERMISSIONS[role].map((permission) => ({ role, permission }))).onConflictDoNothing();
    }

    /* Notifications & content -------------------------------------------- */
    await db.insert(s.notificationTemplates).values([
      { key: "deposit_approved", type: "WALLET", title: "Deposit approved", body: "{{amount}} has been added to your Cash wallet." },
      { key: "withdrawal_completed", type: "WALLET", title: "Withdrawal completed", body: "{{amount}} has been sent to your bank account." },
      { key: "mission_complete", type: "MISSION", title: "Mission complete", body: "{{mission}}" },
      { key: "collection_complete", type: "COLLECTION", title: "Collection complete!", body: "You completed {{collection}}." },
      { key: "referral_reward", type: "REFERRAL", title: "Referral reward earned", body: "{{amount}} is pending from a level {{level}} referral." },
    ]);
    await db.insert(s.banners).values([
      { kind: "BANNER", title: "A prize waits at the end of every map", body: "Collect Loot, reach checkpoints and open the Big Mystery Box to find puzzle pieces.", link: "/play/map", status: "PUBLISHED" },
      { kind: "ANNOUNCEMENT", title: "Welcome to LootBox", body: "Every day brings a new spin, three missions and a mystery event.", status: "PUBLISHED" },
    ]);
    await db.insert(s.faqs).values([
      { category: "Getting started", sortOrder: 0, question: "What is LootBox?", answer: "LootBox is a rewards platform with three games: Mystery Box, Mystery Map and the Vault. You play with Credits, discover items, complete collections and earn rewards you can withdraw once eligible." },
      { category: "Getting started", sortOrder: 1, question: "How do Credits work?", answer: "Credits are bought with Cash from your wallet at the current conversion rate (RM1,000 = 60,000 Credits at launch). The RM value of every Credit price is always shown next to it." },
      { category: "Wallet", sortOrder: 2, question: "How long do deposits take?", answer: "Deposits are manual bank transfers. After you submit your transfer reference, our team verifies it, usually within 30 minutes during business hours." },
      { category: "Wallet", sortOrder: 3, question: "When can I withdraw my rewards?", answer: "Cash rewards first appear as Pending Rewards. After the settlement period (24 hours for game rewards) they move to your Withdrawable balance, which you can withdraw to your saved bank account." },
      { category: "Games", sortOrder: 4, question: "Are results random?", answer: "Yes. Every result is decided by our server using a cryptographically secure random number generator at the moment you play. Odds for each Mystery Box are published on the box page." },
      { category: "Games", sortOrder: 5, question: "What are Fragments and Keys?", answer: "Fragments are pieces of a bigger object. Five Ancient Map Fragments assemble into the Ancient Map, and eight Vault Seal Fragments are needed to open the Vault. Keys unlock Special Areas and the Vault." },
      { category: "Referrals", sortOrder: 6, question: "How do referrals work?", answer: "Share your code. When someone you referred makes their first qualifying deposit, you earn a referral reward. Rewards up to three levels deep become withdrawable after a short review period." },
      { category: "Responsible play", sortOrder: 7, question: "Can I set limits?", answer: "Yes. In Account > Responsible Play you can set a daily Credit spending limit or take a break from play for a period you choose." },
    ]);
    await db.insert(s.helpArticles).values([
      { slug: "making-a-deposit", title: "Making a deposit", category: "Wallet", summary: "Step-by-step guide to manual bank transfers.", body: "1. Open Wallet and tap Deposit.\n2. Enter the amount and choose a bank account.\n3. Transfer the exact amount from your bank.\n4. Submit your transfer reference and, if asked, a screenshot.\n5. Your deposit shows as Pending until our team approves it. Approved deposits appear in your Cash wallet." },
      { slug: "withdrawing-rewards", title: "Withdrawing rewards", category: "Wallet", summary: "How rewards become withdrawable and how to cash out.", body: "Cash rewards start as Pending Rewards and settle into your Withdrawable balance after the settlement period. Add a bank account under Account > Withdrawal accounts, then request a withdrawal from Wallet > Withdraw. Withdrawals move through Pending, Approved, Processing and Completed." },
      { slug: "mystery-map-guide", title: "Exploring the Mystery Map", category: "Games", summary: "Areas, tiles, Special Areas and the Vault.", body: "Start on the Beach. Each tile you discover reveals a reward. Discover six tiles in an area to unlock the next one. Special Areas like the Temple need specific keys, items and collection progress. Your daily free discoveries reset every day." },
      { slug: "account-security", title: "Keeping your account secure", category: "Account", summary: "Passwords, sessions and verification.", body: "Use a unique password, review your active sessions from Account > Security, and never share your login. LootBox staff will never ask for your password." },
    ]);
    const page = (slug: string, title: string, body: string) => ({ slug, title, body });
    await db.insert(s.contentPages).values([
      page("terms", "Terms of Service", "These terms govern your use of LootBox.\n\n1. Eligibility. You must be 18 or older and legally permitted to use rewards platforms in your jurisdiction.\n\n2. Accounts. One account per person. You are responsible for activity on your account.\n\n3. Credits. Credits are purchased with Cash at the published conversion rate, have no cash value outside the platform and cannot be transferred between users.\n\n4. Rewards. Game outcomes are determined by our servers. Cash rewards become withdrawable after the settlement period and subject to eligibility checks.\n\n5. Deposits and withdrawals. Deposits are credited only after verification. Withdrawals are paid to bank accounts in your name.\n\n6. Fair use. We may review, hold or reverse rewards obtained through fraud, abuse or error, and suspend accounts involved.\n\n7. Changes. We may update these terms and will notify you in the app."),
      page("privacy", "Privacy Policy", "We collect the information needed to run your account: your name, email, phone number (optional), transaction history, and technical signals such as IP address and a first-party device identifier used for security and fraud prevention.\n\nWe use this information to operate the service, process deposits and withdrawals, prevent abuse, and provide support. We do not sell your personal data.\n\nYou can request access to or deletion of your data by contacting support."),
      page("responsible-play", "Responsible Play", "LootBox should be fun. Only spend what you can comfortably afford.\n\nTools available to you:\n- Daily Credit spending limit\n- Take a break (self-exclusion) for 1 day to 6 months\n- Full transaction history in your wallet\n\nIf play stops being fun, take a break and reach out to our support team. We are happy to help you set limits or close your account."),
      page("about", "How LootBox works", "Deposit Cash, convert it to Credits, and play three games: Mystery Box, Mystery Map and the Vault. Collect items and fragments, complete collections, and earn rewards you can withdraw."),
    ]);

    await db.insert(s.appConfig).values({ key: "seed_version", value: { version: 1, at: new Date().toISOString() } });
    console.log("Content seeded.");
  } else {
    console.log("Content already seeded, skipping content.");
  }

  /* ------------------------------------------------------------------ */
  /* Demo accounts via Neon Auth                                         */
  /* ------------------------------------------------------------------ */
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const origin = process.env.SEED_ORIGIN ?? "http://localhost:3000";
  const password = process.env.SEED_PASSWORD ?? "LootBox-Demo-2026";
  if (!baseUrl) {
    console.log("NEON_AUTH_BASE_URL missing; skipping demo accounts.");
    return;
  }
  const authUser = async (email: string, name: string): Promise<{ id: string; email: string; name: string }> => {
    const headers = { "content-type": "application/json", origin };
    let res = await fetch(`${baseUrl}/sign-up/email`, { method: "POST", headers, body: JSON.stringify({ email, password, name }) });
    if (!res.ok) res = await fetch(`${baseUrl}/sign-in/email`, { method: "POST", headers, body: JSON.stringify({ email, password }) });
    if (!res.ok) throw new Error(`Auth failed for ${email}: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { user: { id: string; email: string; name: string } };
    return body.user;
  };

  const { seedAdventure } = await import("@/server/content/adventure-seed");
  await seedAdventure((msg) => console.log(`  ${msg}`));

  const actors: Record<string, Awaited<ReturnType<typeof ensureProfile>>> = {};
  const accounts: [string, string, (typeof s.profiles.$inferInsert)["role"]][] = [
    ["admin@lootbox.my", "Aisha Rahman", "SUPER_ADMIN"],
    ["finance@lootbox.my", "Farid Hassan", "FINANCE"],
    ["support@lootbox.my", "Sarah Lim", "SUPPORT"],
    ["games@lootbox.my", "Gavin Tan", "GAME_ADMIN"],
    ["demo@lootbox.my", "Daniel Wong", "USER"],
  ];
  for (const [email, name, role] of accounts) {
    const u = await authUser(email, name);
    const p = await ensureProfile({ id: u.id, email, name }, { ip: "203.0.113.10", deviceId: `seed-${email}` });
    await db.update(s.profiles).set({ role, phone: role === "USER" ? "+60123456789" : null }).where(eq(s.profiles.id, p.id));
    actors[email] = { ...p, role: role ?? "USER" };
    console.log(`  ${role?.padEnd(12)} ${email}`);
  }
  const demo = actors["demo@lootbox.my"];
  const finance = { id: actors["finance@lootbox.my"].id, role: "FINANCE" };

  const [alreadyDemo] = await db.select().from(s.deposits).where(eq(s.deposits.userId, demo.id)).limit(1);
  if (!alreadyDemo) {
    console.log("Creating demo activity...");
    const friendAuth = await authUser("friend@lootbox.my", "Mei Ling Chen");
    const friend = await ensureProfile({ id: friendAuth.id, email: "friend@lootbox.my", name: "Mei Ling Chen" }, { referralCode: demo.referralCode, ip: "198.51.100.23", deviceId: "seed-friend" });

    const dep = await createDeposit(demo.id, { amount: "1000.00", reference: "MBB-20260927-0001", payerName: "Daniel Wong", method: "BANK_TRANSFER", idempotencyKey: "seed-demo-dep-1" });
    await approveDeposit(finance, dep.id, "Matched bank statement");
    await convertCashToCredits(demo.id, { cashAmount: "500.00", idempotencyKey: "seed-demo-convert-1" });

    const [box] = await db.select().from(s.mysteryBoxes).where(eq(s.mysteryBoxes.slug, "island-box"));
    await playMysteryBox(demo.id, { boxId: box.id, selectedIndex: 4, idempotencyKey: "seed-demo-box-1" });
    const [beach] = await db.select().from(s.mapAreas).where(eq(s.mapAreas.slug, "beach"));
    const beachTiles = await db.select().from(s.mapTiles).where(eq(s.mapTiles.areaId, beach.id)).limit(5);
    for (const t of beachTiles) await discoverTile(demo.id, t.id);

    await db.transaction(async (tx) => {
      await createCashReward(tx, { userId: demo.id, amount: "150.00", source: "GAME_REWARD", sourceType: "seed", sourceId: "demo", key: "seed-demo-reward-1", description: "Welcome treasure", pendingHours: 0 });
      await createCashReward(tx, { userId: demo.id, amount: "1100.00", source: "GAME_REWARD", sourceType: "seed", sourceId: "demo", key: "seed-demo-reward-2", description: "Vault reward", pendingHours: 0 });
      await createCashReward(tx, { userId: demo.id, amount: "45.00", source: "GAME_REWARD", sourceType: "seed", sourceId: "demo", key: "seed-demo-reward-3", description: "Treasure reward", pendingHours: 24 });
    });
    await settleDueRewards({ userId: demo.id });

    const today = appDay(new Date(), CONFIG_DEFAULTS.timezone);
    await db.update(s.userStreaks).set({ current: 11, longest: 14, lastClaimDay: addDays(today, -1), runStartDay: addDays(today, -11) }).where(eq(s.userStreaks.userId, demo.id));
    await addWithdrawalAccount(demo.id, { bankName: "Maybank", accountName: "Daniel Wong", accountNumber: "1122 3344 5566" });

    await createDeposit(friend.id, { amount: "300.00", reference: "CIMB-20260927-7781", payerName: "Mei Ling Chen", method: "DUITNOW", idempotencyKey: "seed-friend-dep-1" });
    await createTicket(demo.id, { subject: "How do I unlock the Temple?", category: "GAMES", body: "I have the Ancient Map but the Temple still shows locked. What else do I need?" });
    const existingItems = await db.select().from(s.inventory).where(and(eq(s.inventory.userId, demo.id)));
    console.log(`  demo inventory items: ${existingItems.length}`);
  }
  console.log(`\nDemo password for all seeded accounts: ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
