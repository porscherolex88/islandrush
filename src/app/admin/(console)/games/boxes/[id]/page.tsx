import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart, ChartCard } from "@/components/admin/charts";
import { PoolTable } from "@/components/admin/pool-table";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { AdminCard, AdminPage, DataTable, StatGrid, StatsCard, UserLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { mysteryBoxes, mysteryBoxPlays, profiles, rewardPools } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatCredits } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { poolDistribution } from "@/server/admin/pools";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Mystery Box" };

export default async function BoxPage({ params }: PageProps<"/admin/games/boxes/[id]">) {
  const fiat = await getFiatDisplay();
  await requireAdmin("games.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [box] = await db.select({ b: mysteryBoxes, pool: rewardPools }).from(mysteryBoxes).innerJoin(rewardPools, eq(rewardPools.id, mysteryBoxes.rewardPoolId)).where(eq(mysteryBoxes.id, id)).limit(1);
  if (!box) notFound();
  const back = `/admin/games/boxes/${id}`;
  const [lootPool] = box.b.lootPoolId ? await db.select().from(rewardPools).where(eq(rewardPools.id, box.b.lootPoolId)).limit(1) : [];
  const isAdventure = box.b.level !== null;
  const [stats, dist, positions, daily, recent, lootDist] = await Promise.all([
    one<{ plays: number; week: number; today: number; players: number; spent: string }>(sql`
      select count(*)::int as plays,
        count(*) filter (where created_at > now() - interval '7 days')::int as week,
        count(*) filter (where app_day = (now() at time zone 'Asia/Kuala_Lumpur')::date)::int as today,
        count(distinct user_id)::int as players, coalesce(sum(credits_spent), 0)::text as spent
      from mystery_box_plays where box_id = ${id}`),
    poolDistribution(box.pool.id, box.pool.mode),
    rows<{ i: number; n: number }>(sql`select selected_index as i, count(*)::int as n from mystery_box_plays where box_id = ${id} group by 1`),
    rows<{ d: string; n: number }>(sql`
      select app_day::text as d, count(*)::int as n from mystery_box_plays
      where box_id = ${id} and created_at > now() - interval '30 days' group by 1 order by 1`),
    db
      .select({ p: mysteryBoxPlays, name: profiles.name, email: profiles.email })
      .from(mysteryBoxPlays)
      .innerJoin(profiles, eq(profiles.id, mysteryBoxPlays.userId))
      .where(eq(mysteryBoxPlays.boxId, id))
      .orderBy(desc(mysteryBoxPlays.createdAt))
      .limit(15),
    lootPool ? poolDistribution(lootPool.id, lootPool.mode) : null,
  ]);
  const pos = new Map(positions.map((p) => [p.i, p.n]));
  const maxPos = Math.max(1, ...positions.map((p) => p.n));

  return (
    <AdminPage
      title={box.b.name}
      description={`${isAdventure ? `Adventure level ${box.b.level} · ${box.b.requiresMapLevel ? `unlocks after Map ${box.b.requiresMapLevel}` : "open from the start"} · ` : ""}${formatCredits(box.b.priceCredits)} Credits per open · pool: ${box.pool.name}`}
      actions={
        <>
          <StatusBadge status={box.b.status} />
          <Button asChild variant="outline">
            <Link href={`/admin/economy/pools/${box.pool.id}`}>Edit reward pool</Link>
          </Button>
        </>
      }
    >
      <StatGrid cols={5}>
        <StatsCard label="Total opens" value={stats.plays.toLocaleString()} />
        <StatsCard label="Opens today" value={stats.today} />
        <StatsCard label="Opens (7 days)" value={stats.week} />
        <StatsCard label="Unique players" value={stats.players} />
        <StatsCard label="Credits spent" value={formatCredits(stats.spent)} />
      </StatGrid>
      <AdminCard title="Configured vs historical distribution" description="The reward is drawn server-side before the chosen box is revealed. Box position never affects odds." bodyClassName="p-0">
        <PoolTable stats={dist.stats} back={back} fiat={fiat} />
      </AdminCard>
      {lootPool && lootDist && (
        <AdminCard
          title="Loot drop"
          description={`Granted with every open, in addition to the reward above. Pool: ${lootPool.name}`}
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/economy/pools/${lootPool.id}`}>Edit Loot pool</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          <PoolTable stats={lootDist.stats} back={back} fiat={fiat} />
        </AdminCard>
      )}
      <div className={cn("grid gap-4", !isAdventure && "lg:grid-cols-[1fr_1.5fr]")}>
        {!isAdventure && <AdminCard title="3x3 grid preview" description="How often players pick each position">
          <div className="mx-auto grid max-w-64 grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => {
              const n = pos.get(i) ?? 0;
              return (
                <div
                  key={i}
                  className={cn("flex aspect-square flex-col items-center justify-center rounded-xl border text-center")}
                  style={{ background: `color-mix(in oklab, ${box.b.theme.color} ${Math.round((n / maxPos) * 55) + 8}%, transparent)` }}
                >
                  <span className="text-xl">🎁</span>
                  <span className="text-xs font-semibold tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>
        </AdminCard>}
        <ChartCard title="Opens per day (30 days)">
          <BarChart data={daily.map((d) => ({ label: d.d.slice(5), value: d.n }))} />
        </ChartCard>
      </div>
      <AdminCard title="Recent opens" bodyClassName="p-0">
        <DataTable
          rows={recent}
          rowKey={(r) => r.p.id}
          empty="No opens yet"
          columns={[
            { key: "t", header: "Time", cell: (r) => formatDateTime(r.p.createdAt) },
            { key: "u", header: "Player", cell: (r) => <UserLink id={r.p.userId} name={r.name} email={r.email} /> },
            ...(isAdventure ? [] : [{ key: "i", header: "Box", align: "right" as const, cell: (r: (typeof recent)[number]) => `#${r.p.selectedIndex + 1}` }]),
            { key: "r", header: "Reward", cell: (r) => String(r.p.reward.label ?? r.p.reward.type ?? "") },
            { key: "c", header: "Spent", align: "right", cell: (r) => formatCredits(r.p.creditsSpent) },
          ]}
        />
      </AdminCard>
      <AdminCard title="Box settings">
        <ResourceEditor resource="boxes" id={id} back={back} />
      </AdminCard>
    </AdminPage>
  );
}
