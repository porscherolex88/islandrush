import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appConfig,
  collections,
  depositLevels,
  items,
  mapAreas,
  mapTiles,
  maps,
  missionDefinitions,
  mysteryBoxes,
  profiles,
  requirements,
  rewardPoolEntries,
  rewardPools,
  vaults,
  xpLevels,
  xpRules,
} from "@/db/schema";
import { approveDeposit, createDeposit } from "@/server/services/deposits";
import { ensureProfile } from "@/server/services/profiles";

let counter = 0;
export const uid = (prefix = "user") => `${prefix}_${++counter}_${Math.random().toString(36).slice(2, 8)}`;

export async function makeUser(opts: { role?: (typeof profiles.$inferInsert)["role"]; referralCode?: string; ip?: string; deviceId?: string } = {}) {
  const id = uid();
  const profile = await ensureProfile({ id, email: `${id}@test.dev`, name: `Test ${id}` }, { referralCode: opts.referralCode, ip: opts.ip, deviceId: opts.deviceId });
  if (opts.role && opts.role !== "USER") {
    await db.update(profiles).set({ role: opts.role }).where(eq(profiles.id, id));
    return { ...profile, role: opts.role };
  }
  return profile;
}

export const admin = { id: "admin_actor", role: "SUPER_ADMIN" };

export async function ensureAdminActor() {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, admin.id)).limit(1);
  if (!existing) {
    await ensureProfile({ id: admin.id, email: "admin@test.dev", name: "Admin" });
    await db.update(profiles).set({ role: "SUPER_ADMIN" }).where(eq(profiles.id, admin.id));
  }
  return admin;
}

export async function fundCash(userId: string, amount: string) {
  await ensureAdminActor();
  const dep = await createDeposit(userId, {
    amount,
    reference: `REF-${uid("ref")}`,
    payerName: "Test Payer",
    method: "BANK_TRANSFER",
    idempotencyKey: uid("dep"),
  });
  await approveDeposit(admin, dep.id);
  return dep;
}

export async function setConfigRaw(key: string, value: unknown) {
  await db.insert(appConfig).values({ key, value: value as object }).onConflictDoUpdate({ target: appConfig.key, set: { value: value as object } });
}

export async function makePool(
  mode: "WEIGHTED" | "ALL",
  entries: Partial<typeof rewardPoolEntries.$inferInsert>[],
) {
  const [pool] = await db.insert(rewardPools).values({ name: uid("pool"), mode }).returning();
  if (entries.length) {
    await db.insert(rewardPoolEntries).values(
      entries.map((e, i) => ({
        poolId: pool.id,
        label: e.label ?? `Entry ${i}`,
        rewardType: e.rewardType ?? "CREDITS",
        amount: e.amount ?? (e.rewardType === "ITEM" ? "1" : "100"),
        weight: e.weight ?? 1,
        ...e,
      })),
    );
  }
  return pool;
}

export async function makeItem(input: Partial<typeof items.$inferInsert> & { name: string }) {
  const [item] = await db
    .insert(items)
    .values({ slug: uid("item"), kind: "COLLECTIBLE", purpose: "Test purpose", ...input })
    .returning();
  return item;
}

export async function makeCollection(name = "Test Collection", completionRewardPoolId?: string) {
  const [col] = await db.insert(collections).values({ slug: uid("col"), name, completionRewardPoolId }).returning();
  return col;
}

export async function makeBox(poolId: string, price = 8000, extra: Partial<typeof mysteryBoxes.$inferInsert> = {}) {
  const [box] = await db.insert(mysteryBoxes).values({ slug: uid("box"), name: "Test Box", priceCredits: price, rewardPoolId: poolId, ...extra }).returning();
  return box;
}

export async function makeMap() {
  const [map] = await db.insert(maps).values({ slug: uid("map"), name: "Test Island" }).returning();
  return map;
}

export async function makeArea(mapId: string, extra: Partial<typeof mapAreas.$inferInsert> = {}) {
  const [area] = await db.insert(mapAreas).values({ mapId, slug: uid("area"), name: "Area", ...extra }).returning();
  return area;
}

export async function makeTiles(areaId: string, count: number, extra: Partial<typeof mapTiles.$inferInsert> = {}) {
  return db
    .insert(mapTiles)
    .values(Array.from({ length: count }, (_, i) => ({ areaId, row: Math.floor(i / 4), col: i % 4, name: `Tile ${i}`, ...extra })))
    .returning();
}

export async function addRequirement(input: typeof requirements.$inferInsert) {
  const [r] = await db.insert(requirements).values(input).returning();
  return r;
}

export async function makeVault(rewardPoolId?: string) {
  const [v] = await db.insert(vaults).values({ slug: uid("vault"), name: "Test Vault", rewardPoolId }).returning();
  return v;
}

export async function seedProgression() {
  await db
    .insert(xpRules)
    .values([
      { source: "DAILY_LOGIN", label: "Daily login", amount: 10 },
      { source: "DAILY_SPIN", label: "Daily spin", amount: 5 },
      { source: "BOX_OPEN", label: "Box open", amount: 20 },
      { source: "TILE_DISCOVER", label: "Tile discover", amount: 15 },
      { source: "MISSION_COMPLETE", label: "Mission", amount: 10 },
      { source: "MISSIONS_ALL", label: "All missions", amount: 25 },
      { source: "COLLECTION_COMPLETE", label: "Collection", amount: 100 },
      { source: "VAULT_UNLOCK", label: "Vault", amount: 250 },
      { source: "AREA_UNLOCK", label: "Area", amount: 50 },
      { source: "STREAK_MILESTONE", label: "Streak", amount: 30 },
    ])
    .onConflictDoNothing();
  await db
    .insert(xpLevels)
    .values([
      { level: 1, title: "Castaway", xpRequired: 0 },
      { level: 2, title: "Beachcomber", xpRequired: 50 },
      { level: 3, title: "Explorer", xpRequired: 150 },
    ])
    .onConflictDoNothing();
  await db
    .insert(depositLevels)
    .values([
      { name: "Starter", sortOrder: 0, threshold: "0" },
      { name: "Bronze", sortOrder: 1, threshold: "500" },
      { name: "Silver", sortOrder: 2, threshold: "2000" },
    ])
    .onConflictDoNothing();
}

export async function seedMissions() {
  return db
    .insert(missionDefinitions)
    .values([
      { key: "open_box", title: "Open 1 Mystery Box", action: "OPEN_BOX", target: 1 },
      { key: "discover_2", title: "Discover 2 Map Tiles", action: "DISCOVER_TILE", target: 2 },
      { key: "spin", title: "Complete Daily Spin", action: "DAILY_SPIN", target: 1 },
    ])
    .onConflictDoNothing()
    .returning();
}
