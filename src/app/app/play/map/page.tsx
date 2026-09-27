import type { Metadata } from "next";
import { MapCanvas, type AreaViewModel } from "@/components/app/map";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/server/services/config";
import { getDailyState } from "@/server/services/daily";
import { getBalances } from "@/server/services/ledger";
import { getMapState } from "@/server/services/map";

export const metadata: Metadata = { title: "Mystery Map" };

export default async function MapPage() {
  const user = await requireUser();
  const [state, daily, balances, enabled] = await Promise.all([getMapState(user.id), getDailyState(user.id), getBalances(user.id), isFeatureEnabled("mystery_map")]);

  if (!enabled || !state) {
    return (
      <div>
        <PageHeader title="Mystery Map" back="/app/play" />
        <Section>
          <EmptyState icon="🗺️" title={enabled ? "The map is being drawn" : "The map is taking a short break"} description="Check back soon to start exploring." />
        </Section>
      </div>
    );
  }

  const areas: AreaViewModel[] = state.areas.map((a) => ({
    id: a.id,
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

  return (
    <div>
      <PageHeader title={state.map.name} subtitle={state.map.description} back="/app/play" />
      <Section>
        <div className="mb-3 flex items-center gap-3">
          <Progress value={(state.discovered / Math.max(1, state.totalTiles)) * 100} className="h-2" indicatorClassName="bg-emerald-500" aria-label="Map progress" />
          <span className="text-xs font-bold whitespace-nowrap text-muted-foreground tabular">
            {state.discovered}/{state.totalTiles}
          </span>
        </div>
        <MapCanvas areas={areas} freeLeft={daily.freeDiscoveriesLeft} freeTotal={daily.freeDiscoveries} credits={Number(balances.CREDITS)} />
      </Section>
    </div>
  );
}
