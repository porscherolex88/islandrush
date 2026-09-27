import { desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PoolTable } from "@/components/admin/pool-table";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { AdminCard, AdminPage, DataTable, StatGrid, StatsCard, UserLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { collectionCompletions, collections, profiles, rewardPools } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { poolDistribution } from "@/server/admin/pools";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionPage({ params }: PageProps<"/admin/collections/[id]">) {
  await requireAdmin("collections.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [col] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  if (!col) notFound();
  const back = `/admin/collections/${id}`;
  const b = encodeURIComponent(back);
  const [itemRows, stats, recent, pool] = await Promise.all([
    rows<{ id: string; name: string; icon: string; kind: string; rarity: string; status: string; owners: number; circulating: number; acquired: number }>(sql`
      select i.id, i.name, i.icon, i.kind::text, i.rarity::text, i.status::text,
        count(inv.user_id) filter (where inv.quantity > 0)::int as owners,
        coalesce(sum(inv.quantity), 0)::int as circulating,
        coalesce(sum(inv.total_acquired), 0)::int as acquired
      from items i left join inventory inv on inv.item_id = i.id
      where i.collection_id = ${id}
      group by i.id order by i.sort_order, i.name`),
    one<{ completions: number; collectors: number }>(sql`
      select (select count(*)::int from collection_completions where collection_id = ${id}) as completions,
        (select count(distinct inv.user_id)::int from inventory inv join items i on i.id = inv.item_id where i.collection_id = ${id} and inv.total_acquired > 0) as collectors`),
    db
      .select({ c: collectionCompletions, name: profiles.name, email: profiles.email })
      .from(collectionCompletions)
      .innerJoin(profiles, eq(profiles.id, collectionCompletions.userId))
      .where(eq(collectionCompletions.collectionId, id))
      .orderBy(desc(collectionCompletions.createdAt))
      .limit(10),
    col.completionRewardPoolId ? db.select().from(rewardPools).where(eq(rewardPools.id, col.completionRewardPoolId)).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);
  const dist = pool ? await poolDistribution(pool.id, pool.mode) : null;
  const rate = stats.collectors ? (stats.completions / stats.collectors) * 100 : 0;

  return (
    <AdminPage
      title={`${col.icon} ${col.name}`}
      description={col.description}
      actions={
        <>
          <StatusBadge status={col.status} />
          <Button asChild>
            <Link href={`/admin/manage/items/new?collectionId=${id}&back=${b}`}>
              <Plus /> Add item
            </Link>
          </Button>
        </>
      }
    >
      <StatGrid cols={4}>
        <StatsCard label="Items" value={itemRows.length} />
        <StatsCard label="Collectors" value={stats.collectors} hint="Players with at least one item" />
        <StatsCard label="Completions" value={stats.completions} />
        <StatsCard label="Completion rate" value={`${rate.toFixed(1)}%`} />
      </StatGrid>
      <AdminCard title="Items" bodyClassName="p-0">
        <DataTable
          rows={itemRows}
          rowKey={(i) => i.id}
          empty="No items in this collection yet"
          columns={[
            { key: "n", header: "Item", cell: (i) => <Link href={`/admin/manage/items/${i.id}?back=${b}`} className="font-medium text-primary hover:underline">{i.icon} {i.name}</Link> },
            { key: "k", header: "Kind", cell: (i) => <span className="text-xs">{i.kind}</span> },
            { key: "r", header: "Rarity", cell: (i) => <span className="text-xs">{i.rarity}</span> },
            { key: "o", header: "Owners", align: "right", cell: (i) => i.owners },
            { key: "ci", header: "In circulation", align: "right", cell: (i) => i.circulating },
            { key: "a", header: "Ever acquired", align: "right", cell: (i) => i.acquired },
            { key: "s", header: "Status", cell: (i) => <StatusBadge status={i.status} /> },
          ]}
        />
      </AdminCard>
      {dist && pool && (
        <AdminCard
          title={`Completion reward: ${pool.name}`}
          bodyClassName="p-0"
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/economy/pools/${pool.id}`}>Edit pool</Link>
            </Button>
          }
        >
          <PoolTable stats={dist.stats} back={`/admin/economy/pools/${pool.id}`} showObserved={false} />
        </AdminCard>
      )}
      <AdminCard title="Recent completions" bodyClassName="p-0">
        <DataTable
          rows={recent}
          rowKey={(r) => r.c.id}
          empty="No completions yet"
          columns={[
            { key: "t", header: "Time", cell: (r) => formatDateTime(r.c.createdAt) },
            { key: "u", header: "Player", cell: (r) => <UserLink id={r.c.userId} name={r.name} email={r.email} /> },
            { key: "r", header: "Rewards", cell: (r) => `${r.c.rewards.length} granted` },
          ]}
        />
      </AdminCard>
      <AdminCard title="Collection settings">
        <ResourceEditor resource="collections" id={id} back={back} />
      </AdminCard>
    </AdminPage>
  );
}
