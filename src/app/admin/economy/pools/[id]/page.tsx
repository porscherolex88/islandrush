import { eq, or, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PoolTable } from "@/components/admin/pool-table";
import { ResourceForm } from "@/components/admin/resource-form";
import { AdminCard, AdminPage, StatGrid, StatsCard } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import * as s from "@/db/schema";
import { RESOURCES } from "@/lib/admin/resource-fields";
import { requireAdmin } from "@/lib/auth/session";
import { getFiatDisplay } from "@/lib/fiat-display";
import { poolDistribution } from "@/server/admin/pools";
import { serializeRow } from "@/server/admin/resources";

export const metadata: Metadata = { title: "Reward pool" };

export default async function PoolPage({ params }: PageProps<"/admin/economy/pools/[id]">) {
  const fiat = await getFiatDisplay();
  await requireAdmin("economy.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [pool] = await db.select().from(s.rewardPools).where(eq(s.rewardPools.id, id)).limit(1);
  if (!pool) notFound();
  const [dist, usedBy] = await Promise.all([
    poolDistribution(id, pool.mode),
    Promise.all([
      db.select({ id: s.mysteryBoxes.id, name: s.mysteryBoxes.name }).from(s.mysteryBoxes).where(eq(s.mysteryBoxes.rewardPoolId, id)).then((r) => r.map((x) => ({ ...x, kind: "Mystery Box", href: `/admin/games/boxes/${x.id}` }))),
      db.select({ id: s.mapAreas.id, name: s.mapAreas.name }).from(s.mapAreas).where(or(eq(s.mapAreas.discoveryPoolId, id), eq(s.mapAreas.unlockRewardPoolId, id))).then((r) => r.map((x) => ({ ...x, kind: "Map area", href: `/admin/games/areas/${x.id}` }))),
      db.select({ id: s.vaults.id, name: s.vaults.name }).from(s.vaults).where(eq(s.vaults.rewardPoolId, id)).then((r) => r.map((x) => ({ ...x, kind: "Vault", href: `/admin/games/vaults/${x.id}` }))),
      db.select({ id: s.collections.id, name: s.collections.name }).from(s.collections).where(eq(s.collections.completionRewardPoolId, id)).then((r) => r.map((x) => ({ ...x, kind: "Collection completion", href: `/admin/collections/${x.id}` }))),
      db.select({ id: s.streakMilestones.id, name: s.streakMilestones.title }).from(s.streakMilestones).where(eq(s.streakMilestones.rewardPoolId, id)).then((r) => r.map((x) => ({ ...x, kind: "Streak milestone", href: `/admin/manage/streakMilestones/${x.id}` }))),
      db.select({ id: s.achievements.id, name: s.achievements.name }).from(s.achievements).where(eq(s.achievements.rewardPoolId, id)).then((r) => r.map((x) => ({ ...x, kind: "Achievement", href: `/admin/manage/achievements/${x.id}` }))),
      db
        .select({ id: s.dailySchedules.id, name: sql<string>`${s.dailySchedules.day}::text` })
        .from(s.dailySchedules)
        .where(or(eq(s.dailySchedules.spinPoolId, id), eq(s.dailySchedules.missionBonusPoolId, id)))
        .then((r) => r.map((x) => ({ ...x, kind: "Daily schedule", href: `/admin/daily/${x.id}` }))),
    ]).then((groups) => groups.flat()),
  ]);
  const back = `/admin/economy/pools/${id}`;
  const def = RESOURCES.pools;

  return (
    <AdminPage
      title={pool.name}
      description={pool.mode === "WEIGHTED" ? "One entry is drawn per play, weighted by the entry weights below." : "Every active entry is granted together."}
      actions={
        <Button asChild>
          <Link href={`/admin/manage/poolEntries/new?poolId=${id}&back=${encodeURIComponent(back)}`}>
            <Plus /> Add entry
          </Link>
        </Button>
      }
    >
      <StatGrid cols={4}>
        <StatsCard label="Entries" value={dist.stats.length} />
        <StatsCard label="Active weight" value={dist.totalWeight} />
        <StatsCard label="Historical draws" value={dist.totalObserved.toLocaleString()} />
        <StatsCard label="Used by" value={usedBy.length} />
      </StatGrid>
      <AdminCard title="Configured vs historical distribution" description="Configured odds exclude inactive and exhausted entries." bodyClassName="p-0">
        <PoolTable stats={dist.stats} back={back} fiat={fiat} />
      </AdminCard>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <AdminCard title="Pool settings">
          <ResourceForm resourceKey="pools" singular={def.singular} fields={def.fields} id={id} initial={serializeRow(pool)} options={{}} significant afterSave={back} afterDelete="/admin/manage/pools" />
        </AdminCard>
        <AdminCard title="Used by">
          {usedBy.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not referenced by any game content.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {usedBy.map((u) => (
                <li key={`${u.kind}-${u.id}`} className="flex justify-between gap-2">
                  <Link href={u.href} className="text-primary hover:underline">
                    {u.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{u.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminPage>
  );
}
