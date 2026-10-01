import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { rewardPools } from "@/db/schema";
import { formatCredits } from "@/lib/money";
import type { DailyPlan } from "@/server/services/daily";

/** Shows what players will actually see for a day after schedule and default resolution. */
export async function DailyPlanPreview({ plan }: { plan: DailyPlan }) {
  const ids = [plan.spinPoolId, plan.missionBonusPoolId, plan.event?.poolId].filter(Boolean) as string[];
  const pools = ids.length ? await db.select({ id: rewardPools.id, name: rewardPools.name }).from(rewardPools).where(inArray(rewardPools.id, ids)) : [];
  const name = (id: string | null | undefined) => (id ? (pools.find((p) => p.id === id)?.name ?? "Unknown pool") : "Not configured");
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-lg border p-3">
        <dt className="text-xs text-muted-foreground">Daily Spin</dt>
        <dd className="font-medium">{name(plan.spinPoolId)}</dd>
      </div>
      <div className="rounded-lg border p-3">
        <dt className="text-xs text-muted-foreground">Free map discoveries</dt>
        <dd className="font-medium">{plan.freeDiscoveries}</dd>
      </div>
      <div className="rounded-lg border p-3 sm:col-span-2">
        <dt className="text-xs text-muted-foreground">Missions (bonus: {name(plan.missionBonusPoolId)})</dt>
        <dd className="mt-1 space-y-1">
          {plan.missions.length === 0 ? (
            <span className="text-amber-600">No active missions</span>
          ) : (
            plan.missions.map((m) => (
              <p key={m.id}>
                {m.icon} {m.title} <span className="text-xs text-muted-foreground">({m.action.replace(/_/g, " ").toLowerCase()} x{m.target})</span>
              </p>
            ))
          )}
        </dd>
      </div>
      <div className="rounded-lg border p-3 sm:col-span-2">
        <dt className="text-xs text-muted-foreground">Mystery event</dt>
        <dd className="font-medium">
          {plan.event ? (
            <>
              {plan.event.icon} {plan.event.title}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {plan.event.costCredits ? `${formatCredits(plan.event.costCredits)} Credits` : "Free"} · {name(plan.event.poolId)}
              </span>
              <p className="text-xs font-normal text-muted-foreground">{plan.event.description}</p>
            </>
          ) : (
            "No event"
          )}
        </dd>
      </div>
    </dl>
  );
}
