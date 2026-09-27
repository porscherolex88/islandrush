import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCredits, formatMYR } from "@/lib/money";
import type { EntryStat } from "@/server/admin/pools";
import { DataTable } from "./ui";

function amountLabel(e: EntryStat) {
  switch (e.rewardType) {
    case "CREDITS":
      return `${formatCredits(Math.round(Number(e.amount)))} Credits`;
    case "CASH":
      return formatMYR(e.amount);
    case "XP":
      return `${Math.round(Number(e.amount))} XP`;
    case "ITEM":
      return `${Math.max(1, Math.round(Number(e.amount)))}x ${e.itemName ?? "item"}`;
    case "AREA_UNLOCK":
      return `Unlock ${e.areaName ?? "area"}`;
    default:
      return e.amount;
  }
}

export function PoolTable({ stats, back, showObserved = true }: { stats: EntryStat[]; back: string; showObserved?: boolean }) {
  return (
    <DataTable
      rows={stats}
      rowKey={(e) => e.id}
      empty="This pool has no entries yet"
      columns={[
        { key: "l", header: "Entry", cell: (e) => <Link href={`/admin/manage/poolEntries/${e.id}?back=${encodeURIComponent(back)}`} className="font-medium text-primary hover:underline">{e.label}</Link> },
        { key: "r", header: "Reward", cell: (e) => amountLabel(e) },
        { key: "ra", header: "Rarity", cell: (e) => <span className="text-xs">{e.rarity}</span> },
        { key: "w", header: "Weight", align: "right", cell: (e) => e.weight },
        {
          key: "p",
          header: "Configured",
          align: "right",
          cell: (e) => (
            <div className="flex items-center justify-end gap-2">
              <div className="hidden h-1.5 w-16 rounded-full bg-muted sm:block">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, e.configuredPct)}%` }} />
              </div>
              {e.configuredPct.toFixed(2)}%
            </div>
          ),
        },
        ...(showObserved
          ? [
              { key: "o", header: "Historical", align: "right" as const, cell: (e: EntryStat) => `${e.observedPct.toFixed(2)}% (${e.observed})` },
            ]
          : []),
        { key: "cap", header: "Awarded / cap", align: "right", cell: (e) => `${e.awardedCount} / ${e.maxAwards ?? "∞"}` },
        { key: "a", header: "State", cell: (e) => (e.active ? (e.maxAwards !== null && e.awardedCount >= e.maxAwards ? <StatusBadge status="HELD" label="Exhausted" /> : <StatusBadge status="ACTIVE" />) : <StatusBadge status="DRAFT" label="Inactive" />) },
      ]}
    />
  );
}
