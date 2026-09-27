import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, mapAreas, rewardPoolEntries } from "@/db/schema";
import { rows } from "./queries";

export type EntryStat = {
  id: string;
  label: string;
  rewardType: string;
  amount: string;
  rarity: string;
  weight: number;
  active: boolean;
  maxAwards: number | null;
  awardedCount: number;
  itemName: string | null;
  areaName: string | null;
  configuredPct: number;
  observed: number;
  observedPct: number;
};

/** Configured vs historical distribution for a pool. Historical counts come from every game that draws from pools. */
export async function poolDistribution(poolId: string, mode: "WEIGHTED" | "ALL") {
  const [entries, hist] = await Promise.all([
    db
      .select({ e: rewardPoolEntries, itemName: items.name, areaName: mapAreas.name })
      .from(rewardPoolEntries)
      .leftJoin(items, eq(items.id, rewardPoolEntries.itemId))
      .leftJoin(mapAreas, eq(mapAreas.id, rewardPoolEntries.areaId))
      .where(eq(rewardPoolEntries.poolId, poolId))
      .orderBy(asc(rewardPoolEntries.sortOrder), asc(rewardPoolEntries.label)),
    rows<{ id: string; n: number }>(sql`
      select pool_entry_id as id, count(*)::int as n from (
        select pool_entry_id from mystery_box_plays
        union all select pool_entry_id from tile_discoveries
        union all select pool_entry_id from daily_spins
      ) x where pool_entry_id in (select id from reward_pool_entries where pool_id = ${poolId}) group by 1`),
  ]);
  const counts = new Map(hist.map((h) => [h.id, h.n]));
  const eligible = (e: (typeof entries)[number]["e"]) => e.active && e.weight > 0 && (e.maxAwards === null || e.awardedCount < e.maxAwards);
  const totalWeight = entries.reduce((s, x) => s + (eligible(x.e) ? x.e.weight : 0), 0);
  const totalObserved = hist.reduce((s, h) => s + h.n, 0);
  const stats: EntryStat[] = entries.map(({ e, itemName, areaName }) => {
    const observed = counts.get(e.id) ?? 0;
    return {
      id: e.id,
      label: e.label,
      rewardType: e.rewardType,
      amount: e.amount,
      rarity: e.rarity,
      weight: e.weight,
      active: e.active,
      maxAwards: e.maxAwards,
      awardedCount: e.awardedCount,
      itemName,
      areaName,
      configuredPct: mode === "ALL" ? (e.active ? 100 : 0) : totalWeight && eligible(e) ? (e.weight / totalWeight) * 100 : 0,
      observed,
      observedPct: totalObserved ? (observed / totalObserved) * 100 : 0,
    };
  });
  return { stats, totalWeight, totalObserved };
}
