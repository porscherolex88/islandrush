import "server-only";
import { asc, eq, getTableColumns, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getResourceDef, type FieldDef, type RelationKey, type ResourceDef, type ResourceKey } from "@/lib/admin/resource-fields";
import { ADVENTURE_LEVELS, isValidPercentSplit } from "@/lib/adventure";
import { AppError } from "@/lib/errors";
import { STREAK_WEEK } from "@/lib/streak";

export const RESOURCE_TABLES: Record<ResourceKey, PgTable> = {
  paymentAccounts: s.paymentAccounts,
  pools: s.rewardPools,
  poolEntries: s.rewardPoolEntries,
  boxes: s.mysteryBoxes,
  maps: s.maps,
  checkpoints: s.mapCheckpoints,
  bigBoxes: s.bigMysteryBoxes,
  puzzles: s.puzzles,
  prizes: s.prizes,
  areas: s.mapAreas,
  tiles: s.mapTiles,
  requirements: s.requirements,
  vaults: s.vaults,
  missions: s.missionDefinitions,
  dailySchedules: s.dailySchedules,
  streakMilestones: s.streakMilestones,
  collections: s.collections,
  items: s.items,
  depositLevels: s.depositLevels,
  achievements: s.achievements,
  referralLevels: s.referralLevels,
  templates: s.notificationTemplates,
  broadcasts: s.broadcasts,
  contentPages: s.contentPages,
  faqs: s.faqs,
  helpArticles: s.helpArticles,
  banners: s.banners,
};

export function loadResource(key: string) {
  const def = getResourceDef(key);
  if (!def) return null;
  const table = RESOURCE_TABLES[key as ResourceKey];
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  return { def, table, columns, pkColumn: columns[def.pk] };
}

export function pkValue(def: ResourceDef, raw: string): string | number {
  if (def.pk === "level") {
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new AppError("Invalid id");
    return n;
  }
  return raw;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY = /^-?\d{1,18}(\.\d{1,2})?$/;

function parseField(f: FieldDef, raw: unknown): unknown {
  const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
  if (f.type === "boolean") return raw === true || raw === "true" || raw === "on";
  if (empty) {
    if (f.required) throw new AppError(`${f.label} is required`);
    if (f.type === "list") return [];
    if (f.type === "json") return f.default ?? {};
    if (f.type === "textarea" || f.type === "text") return f.default !== undefined ? f.default : null;
    return null;
  }
  const str = typeof raw === "string" ? raw.trim() : raw;
  switch (f.type) {
    case "text":
    case "textarea":
    case "color": {
      const v = String(str);
      if (v.length > 20000) throw new AppError(`${f.label} is too long`);
      if (f.name === "slug" && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) throw new AppError("Slug may only contain lowercase letters, numbers and hyphens");
      return v;
    }
    case "number":
    case "credits": {
      const n = Number(str);
      if (!Number.isInteger(n)) throw new AppError(`${f.label} must be a whole number`);
      if (f.type === "credits" && n < 0) throw new AppError(`${f.label} cannot be negative`);
      return n;
    }
    case "money": {
      const v = String(str);
      if (!MONEY.test(v)) throw new AppError(`${f.label} must be a number with up to 2 decimals`);
      return v;
    }
    case "select": {
      const v = String(str);
      if (f.options && !f.options.includes(v)) throw new AppError(`${f.label} has an invalid value`);
      return v;
    }
    case "relation": {
      const v = String(str);
      if (!UUID.test(v)) throw new AppError(`${f.label} is invalid`);
      return v;
    }
    case "json": {
      if (typeof str === "object") return str;
      try {
        return JSON.parse(String(str));
      } catch {
        throw new AppError(`${f.label} must be valid JSON`);
      }
    }
    case "list":
      return (Array.isArray(str) ? str : String(str).split("\n")).map((x) => String(x).trim()).filter(Boolean);
    case "date": {
      const v = String(str);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new AppError(`${f.label} must be a date`);
      return v;
    }
    case "datetime": {
      const d = new Date(String(str));
      if (Number.isNaN(d.getTime())) throw new AppError(`${f.label} must be a valid date and time`);
      return d;
    }
  }
}

type Values = Record<string, unknown>;

const levelOk = (v: unknown) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= ADVENTURE_LEVELS;

const VALIDATORS: Partial<Record<ResourceKey, (v: Values) => void>> = {
  poolEntries: (v) => {
    if (v.rewardType === "ITEM" && !v.itemId) throw new AppError("Choose an item for ITEM rewards");
    if (v.rewardType === "AREA_UNLOCK" && !v.areaId) throw new AppError("Choose an area for AREA_UNLOCK rewards");
    if (Number(v.weight) < 0) throw new AppError("Weight cannot be negative");
    if (["CREDITS", "CASH"].includes(String(v.rewardType)) && Number(v.amount) <= 0) throw new AppError("Amount must be greater than zero");
    if ((v.rewardType === "CREDITS" || v.rewardType === "FREE_UNLOCK") && !Number.isInteger(Number(v.amount))) throw new AppError("Credits amounts must be whole numbers");
  },
  boxes: (v) => {
    if (Number(v.priceCredits) <= 0) throw new AppError("Price must be greater than zero");
    if (!Number.isInteger(Number(v.jackpotPlays ?? 50)) || Number(v.jackpotPlays ?? 50) < 0) throw new AppError("Plays to the jackpot must be 0 or more");
    if (!Number.isInteger(Number(v.jackpotSpins ?? 10)) || Number(v.jackpotSpins ?? 10) < 1 || Number(v.jackpotSpins ?? 10) > 50) throw new AppError("Jackpot free spins must be 1-50");
    if (v.level != null) {
      if (!levelOk(v.level)) throw new AppError(`Adventure level must be 1-${ADVENTURE_LEVELS}`);
      if (v.requiresMapLevel != null && Number(v.requiresMapLevel) >= Number(v.level)) throw new AppError("A box can only require an earlier map");
      if (!v.lootPoolId) throw new AppError("Adventure boxes need a Loot pool");
    }
  },
  maps: (v) => {
    if (v.level != null && !levelOk(v.level)) throw new AppError(`Adventure level must be 1-${ADVENTURE_LEVELS}`);
    if (Number(v.lootRequired ?? 0) < 0) throw new AppError("Loot to unlock cannot be negative");
  },
  checkpoints: (v) => {
    if (Number(v.position) < 1) throw new AppError("Order must be at least 1");
    if (Number(v.lootRequired) < 0) throw new AppError("Loot required cannot be negative");
    for (const k of ["posX", "posY"]) {
      const n = Number(v[k]);
      if (n < 0 || n > 100) throw new AppError("Positions must be between 0 and 100");
    }
  },
  bigBoxes: (v) => {
    if (!isValidPercentSplit([v.pieces1Pct, v.pieces2Pct, v.pieces3Pct].map(Number))) {
      throw new AppError("Piece odds must be whole percentages that total exactly 100%");
    }
  },
  puzzles: (v) => {
    if (!levelOk(v.level)) throw new AppError(`Level must be 1-${ADVENTURE_LEVELS}`);
    if (Number(v.piecesRequired) < 1) throw new AppError("Pieces required must be at least 1");
    if (Number(v.alternativeRewardAmount) <= 0) throw new AppError("The alternative reward must be greater than zero");
    if (v.alternativeRewardType === "CREDITS" && !Number.isInteger(Number(v.alternativeRewardAmount))) throw new AppError("Credit amounts must be whole numbers");
  },
  prizes: (v) => {
    if (!levelOk(v.level)) throw new AppError(`Level must be 1-${ADVENTURE_LEVELS}`);
    if (v.kind !== "PHYSICAL" && Number(v.amount) <= 0) throw new AppError("Credits and Cash prizes need an amount");
    if (v.kind === "CREDITS" && !Number.isInteger(Number(v.amount))) throw new AppError("Credit amounts must be whole numbers");
    if (v.inventoryTotal != null && Number(v.inventoryTotal) < 0) throw new AppError("Inventory cannot be negative");
    if (v.inventoryTotal != null && v.inventoryAllocated != null && Number(v.inventoryTotal) < Number(v.inventoryAllocated)) {
      throw new AppError(`Inventory cannot be lower than the ${v.inventoryAllocated} already unlocked`);
    }
  },
  tiles: (v) => {
    if (Number(v.row) < 0 || Number(v.col) < 0) throw new AppError("Row and column must be 0 or more");
  },
  requirements: (v) => {
    if (v.type === "ITEM" && !v.itemId) throw new AppError("Choose an item");
    if (String(v.type).startsWith("COLLECTION") && !v.collectionId) throw new AppError("Choose a collection");
    if (String(v.type).startsWith("AREA") && !v.areaId) throw new AppError("Choose an area");
    if (Number(v.quantity) < 1) throw new AppError("Quantity must be at least 1");
  },
  referralLevels: (v) => {
    if (Number(v.level) < 1 || Number(v.level) > 3) throw new AppError("Referral level must be 1, 2 or 3");
    if (Number(v.value) < 0) throw new AppError("Value cannot be negative");
    if (v.rewardKind === "PERCENT" && Number(v.value) > 100) throw new AppError("Percent cannot exceed 100");
  },
  depositLevels: (v) => {
    if (Number(v.threshold) < 0) throw new AppError("Threshold cannot be negative");
  },
  missions: (v) => {
    if (Number(v.target) < 1) throw new AppError("Target must be at least 1");
  },
  streakMilestones: (v) => {
    const d = Number(v.days);
    if (!Number.isInteger(d) || d < 1 || d > STREAK_WEEK) throw new AppError(`Streak rewards repeat weekly, so the day must be 1 to ${STREAK_WEEK}`);
  },
  banners: (v) => {
    if (v.startsAt && v.endsAt && (v.endsAt as Date) <= (v.startsAt as Date)) throw new AppError("End must be after start");
  },
};

/** Coerces and validates raw form values for a resource. Immutable fields are dropped on update. */
export function parseValues(key: ResourceKey, def: ResourceDef, raw: Values, isUpdate: boolean): Values {
  const out: Values = {};
  for (const f of def.fields) {
    if (isUpdate && f.immutable) continue;
    out[f.name] = parseField(f, raw[f.name]);
  }
  VALIDATORS[key]?.(isUpdate ? { ...raw, ...out } : out);
  return out;
}

export type Option = { value: string; label: string };

export async function relationOptions(keys: RelationKey[]): Promise<Partial<Record<RelationKey, Option[]>>> {
  const unique = [...new Set(keys)];
  const entries = await Promise.all(
    unique.map(async (k): Promise<[RelationKey, Option[]]> => {
      switch (k) {
        case "pools":
          return [k, (await db.select({ value: s.rewardPools.id, label: s.rewardPools.name }).from(s.rewardPools).orderBy(asc(s.rewardPools.name)))];
        case "items":
          return [
            k,
            (await db.select({ value: s.items.id, name: s.items.name, icon: s.items.icon, kind: s.items.kind }).from(s.items).orderBy(asc(s.items.name))).map((i) => ({
              value: i.value,
              label: `${i.icon} ${i.name} (${i.kind.toLowerCase()})`,
            })),
          ];
        case "collections":
          return [k, await db.select({ value: s.collections.id, label: s.collections.name }).from(s.collections).orderBy(asc(s.collections.sortOrder))];
        case "maps":
          return [
            k,
            (await db.select({ value: s.maps.id, name: s.maps.name, level: s.maps.level }).from(s.maps).orderBy(asc(s.maps.level), asc(s.maps.name))).map((m) => ({
              value: m.value,
              label: m.level ? `Map ${m.level}: ${m.name}` : m.name,
            })),
          ];
        case "prizes":
          return [
            k,
            (await db.select({ value: s.prizes.id, name: s.prizes.name, level: s.prizes.level }).from(s.prizes).orderBy(asc(s.prizes.level), asc(s.prizes.name))).map((p) => ({
              value: p.value,
              label: `Level ${p.level}: ${p.name}`,
            })),
          ];
        case "areas":
          return [k, await db.select({ value: s.mapAreas.id, label: s.mapAreas.name }).from(s.mapAreas).orderBy(asc(s.mapAreas.sortOrder))];
        case "vaults":
          return [k, await db.select({ value: s.vaults.id, label: s.vaults.name }).from(s.vaults).orderBy(asc(s.vaults.sortOrder))];
        case "missions":
          return [k, await db.select({ value: s.missionDefinitions.id, label: s.missionDefinitions.title }).from(s.missionDefinitions).orderBy(asc(s.missionDefinitions.title))];
        case "owners": {
          const [areas, vaults] = await Promise.all([
            db.select({ value: s.mapAreas.id, name: s.mapAreas.name }).from(s.mapAreas).orderBy(asc(s.mapAreas.sortOrder)),
            db.select({ value: s.vaults.id, name: s.vaults.name }).from(s.vaults).orderBy(asc(s.vaults.sortOrder)),
          ]);
          return [k, [...areas.map((a) => ({ value: a.value, label: `Area: ${a.name}` })), ...vaults.map((v) => ({ value: v.value, label: `Vault: ${v.name}` }))]];
        }
      }
    }),
  );
  return Object.fromEntries(entries);
}

export async function fetchResourceRow(key: string, id: string) {
  const r = loadResource(key);
  if (!r) return null;
  const [row] = await db
    .select()
    .from(r.table)
    .where(eq(r.pkColumn, pkValue(r.def, id)) as SQL)
    .limit(1);
  return (row as Values | undefined) ?? null;
}

/** Serializes a row so it can be passed to client components (dates to ISO strings). */
export function serializeRow(row: Values | null): Values | null {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : typeof v === "bigint" ? v.toString() : v]));
}
