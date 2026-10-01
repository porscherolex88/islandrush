import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { appConfig, featureFlags } from "@/db/schema";
import { audit } from "./audit";

export type ConfigShape = {
  conversion: { cash: string; credits: number };
  timezone: string;
  deposit: { min: string; max: string; proofRequired: boolean; methods: string[] };
  withdrawal: {
    min: string;
    maxPerRequest: string;
    maxDaily: string;
    requiresVerification: boolean;
    minDepositLevelOrder: number;
  };
  rewards: { pendingHours: number };
  referral: {
    enabled: boolean;
    levels: number;
    qualifyingDepositMin: string;
    pendingHours: number;
    velocityThresholdPerDay: number;
  };
  daily_defaults: {
    freeDiscoveries: number;
    spinPoolId: string | null;
    missionKeys: string[];
    missionBonusPoolId: string | null;
    eventTitle: string;
    eventDescription: string;
    eventIcon: string;
    eventPoolId: string | null;
    streakGraceDays: number;
    streakSpinMinDays: number;
    streakSpinPoolId: string | null;
  };
  limits: { gameActionsPerMinute: number; maxBoxOpensPerDay: number | null };
  maintenance: { enabled: boolean; message: string };
  admin_security: { reauthMinutes: number };
  risk: { rapidSignupPerIpPerDay: number; largeDepositAmount: string };
  prize_wheel: { active: boolean; prizeUnlockPct: number; alternativePct: number };
  market: { feePct: number; minPrice: number; maxPrice: number; maxActiveListings: number };
};

export const CONFIG_DEFAULTS: ConfigShape = {
  conversion: { cash: "1000.00", credits: 60000 },
  timezone: "Asia/Kuala_Lumpur",
  deposit: { min: "50.00", max: "50000.00", proofRequired: false, methods: ["BANK_TRANSFER", "DUITNOW"] },
  withdrawal: {
    min: "50.00",
    maxPerRequest: "10000.00",
    maxDaily: "20000.00",
    requiresVerification: false,
    minDepositLevelOrder: 0,
  },
  rewards: { pendingHours: 24 },
  referral: { enabled: true, levels: 3, qualifyingDepositMin: "100.00", pendingHours: 72, velocityThresholdPerDay: 10 },
  daily_defaults: {
    freeDiscoveries: 3,
    spinPoolId: null,
    missionKeys: [],
    missionBonusPoolId: null,
    eventTitle: "Tide Pool Treasure",
    eventDescription: "The tide has pulled back. Search the pools for something washed ashore.",
    eventIcon: "🌊",
    eventPoolId: null,
    streakGraceDays: 0,
    streakSpinMinDays: 7,
    streakSpinPoolId: null,
  },
  limits: { gameActionsPerMinute: 30, maxBoxOpensPerDay: null },
  maintenance: { enabled: false, message: "LootBox is getting a quick tune-up. We'll be right back." },
  admin_security: { reauthMinutes: 720 },
  risk: { rapidSignupPerIpPerDay: 3, largeDepositAmount: "20000.00" },
  prize_wheel: { active: true, prizeUnlockPct: 90, alternativePct: 10 },
  market: { feePct: 15, minPrice: 1, maxPrice: 10_000_000, maxActiveListings: 20 },
};

export type ConfigKey = keyof ConfigShape;

export const CONFIG_DESCRIPTIONS: Record<ConfigKey, string> = {
  conversion: "Cash to Credits conversion rate",
  timezone: "Application timezone used for daily resets",
  deposit: "Manual deposit limits and requirements",
  withdrawal: "Withdrawal limits and eligibility",
  rewards: "Cash reward settlement policy",
  referral: "Referral program policy",
  daily_defaults: "Fallback daily content when no schedule is published",
  limits: "Abuse and play limits",
  maintenance: "Maintenance mode",
  admin_security: "Admin security policy",
  risk: "Risk signal thresholds",
  prize_wheel: "Final Prize Unlock odds. Prize + alternative must total 100%.",
  market: "Player market: fee on each sale (%), price range in Credits and max active listings per player",
};

/** Loads a config row with its last-updated time, used to version odds snapshots. */
export async function getConfigWithVersion<K extends ConfigKey>(key: K, tx: DbOrTx = db): Promise<{ value: ConfigShape[K]; updatedAt: string | null }> {
  const [row] = await tx.select({ updatedAt: appConfig.updatedAt }).from(appConfig).where(eq(appConfig.key, key)).limit(1);
  return { value: await getConfig(key, tx), updatedAt: row?.updatedAt?.toISOString() ?? null };
}

export async function getConfig<K extends ConfigKey>(key: K, tx: DbOrTx = db): Promise<ConfigShape[K]> {
  const [row] = await tx.select().from(appConfig).where(eq(appConfig.key, key)).limit(1);
  if (!row) return CONFIG_DEFAULTS[key];
  const def = CONFIG_DEFAULTS[key];
  if (def && typeof def === "object" && !Array.isArray(def)) {
    return { ...(def as object), ...(row.value as object) } as ConfigShape[K];
  }
  return row.value as ConfigShape[K];
}

export async function setConfig<K extends ConfigKey>(
  key: K,
  value: ConfigShape[K],
  actor: { id: string; role: string },
  reason: string | null,
  tx: DbOrTx = db,
) {
  const before = await getConfig(key, tx);
  await tx
    .insert(appConfig)
    .values({ key, value: value as object, description: CONFIG_DESCRIPTIONS[key], updatedBy: actor.id })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value: value as object, updatedBy: actor.id, updatedAt: new Date() },
    });
  await audit(tx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: "config.update",
    entityType: "app_config",
    entityId: key,
    before,
    after: value,
    reason,
  });
}

export async function getTimezone(tx: DbOrTx = db) {
  return getConfig("timezone", tx);
}

export async function isFeatureEnabled(key: string, tx: DbOrTx = db, fallback = true): Promise<boolean> {
  const [row] = await tx.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
  return row ? row.enabled : fallback;
}

export async function getAllFlags(tx: DbOrTx = db): Promise<Record<string, boolean>> {
  const rows = await tx.select().from(featureFlags);
  return Object.fromEntries(rows.map((r) => [r.key, r.enabled]));
}
