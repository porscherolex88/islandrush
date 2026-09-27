import { Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import { MapCanvas, type AreaViewModel } from "@/components/app/map";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/server/services/config";
import { getRate } from "@/server/services/conversion";
import { getDailyState } from "@/server/services/daily";
import { getBalances } from "@/server/services/ledger";
import { getMapState } from "@/server/services/map";
import { getVaultStates } from "@/server/services/vault";

export const metadata: Metadata = { title: "Mystery Map" };

export default async function MapPage() {
  const user = await requireUser();
  const [state, daily, balances, enabled, rate, vaults] = await Promise.all([
    getMapState(user.id),
    getDailyState(user.id),
    getBalances(user.id),
    isFeatureEnabled("mystery_map"),
    getRate(),
    getVaultStates(user.id),
  ]);

  if (!enabled || !state) {
    return (
      <div>
        <PageHeader title="Mystery Map" back="/app/play" />
        <Section>
          <EmptyState icon={<MapIcon className="size-10 text-primary" />} title={enabled ? "The map is being drawn" : "The map is taking a short break"} description="Check back soon to start exploring." />
        </Section>
      </div>
    );
  }

  const areas: AreaViewModel[] = state.areas.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    description: a.description,
    icon: a.icon,
    color: a.color,
    isSpecial: a.isSpecial,
    accessible: a.accessible,
    canUnlock: a.canUnlock,
    gridCols: a.gridCols,
    requirements: a.requirements.map((r) => ({ id: r.id, label: r.label, icon: r.icon, current: r.current, required: r.required, met: r.met, consume: r.consume })),
    tiles: a.tiles.map((t) => ({ id: t.id, row: t.row, col: t.col, name: t.name, icon: t.icon, discovered: t.discovered, reward: t.reward, cost: t.cost })),
    discoveredCount: a.discoveredCount,
  }));
  const v = vaults[0];
  const keyReq = v?.requirements.find((r) => r.type === "ITEM" && /key/i.test(r.label));

  return (
    <div>
      <PageHeader title={state.map.name} subtitle={state.map.description} back="/app/play" />
      <Section>
        <div className="mb-3 flex items-center gap-3">
          <Progress value={(state.discovered / Math.max(1, state.totalTiles)) * 100} className="h-2.5" indicatorClassName="bg-amber-500" aria-label="Map progress" />
          <span className="text-sm font-bold whitespace-nowrap tabular">
            {state.discovered} / {state.totalTiles} discovered
          </span>
        </div>
        <MapCanvas
          areas={areas}
          freeLeft={daily.freeDiscoveriesLeft}
          freeTotal={daily.freeDiscoveries}
          credits={Number(balances.CREDITS)}
          rate={{ cash: Number(rate.cash), credits: rate.creditsNumber }}
          vault={v ? { name: v.name, unlocked: v.unlocked, ready: v.ready, keys: keyReq ? `${Math.min(keyReq.current, keyReq.required)}/${keyReq.required} Keys` : null } : null}
        />
      </Section>
    </div>
  );
}
