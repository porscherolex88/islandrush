import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PoolTable } from "@/components/admin/pool-table";
import { RequirementsCard } from "@/components/admin/requirements-card";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { AdminCard, AdminPage, DataTable, StatGrid, StatsCard, UserLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { profiles, rewardPools, vaults, vaultUnlocks } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime } from "@/lib/time";
import { poolDistribution } from "@/server/admin/pools";
import { one } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Vault" };

export default async function VaultPage({ params }: PageProps<"/admin/games/vaults/[id]">) {
  const fiat = await getFiatDisplay();
  await requireAdmin("games.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [vault] = await db.select().from(vaults).where(eq(vaults.id, id)).limit(1);
  if (!vault) notFound();
  const back = `/admin/games/vaults/${id}`;
  const [stats, recent, pool] = await Promise.all([
    one<{ unlocks: number; week: number }>(sql`
      select count(*)::int as unlocks, count(*) filter (where created_at > now() - interval '7 days')::int as week
      from vault_unlocks where vault_id = ${id}`),
    db
      .select({ v: vaultUnlocks, name: profiles.name, email: profiles.email })
      .from(vaultUnlocks)
      .innerJoin(profiles, eq(profiles.id, vaultUnlocks.userId))
      .where(eq(vaultUnlocks.vaultId, id))
      .orderBy(desc(vaultUnlocks.createdAt))
      .limit(15),
    vault.rewardPoolId ? db.select().from(rewardPools).where(eq(rewardPools.id, vault.rewardPoolId)).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);
  const dist = pool ? await poolDistribution(pool.id, pool.mode) : null;

  return (
    <AdminPage title={`${vault.icon} ${vault.name}`} description={vault.description} actions={<StatusBadge status={vault.status} />}>
      <StatGrid cols={3}>
        <StatsCard label="Total unlocks" value={stats.unlocks} />
        <StatsCard label="Unlocks (7 days)" value={stats.week} />
        <StatsCard label="Reward pool" value={pool?.name ?? "None"} />
      </StatGrid>
      <RequirementsCard ownerType="VAULT" ownerId={id} back={back} description="Players must meet every requirement. Items marked consumed are removed on unlock." />
      {dist && pool && (
        <AdminCard
          title={`Rewards: ${pool.name}`}
          bodyClassName="p-0"
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/economy/pools/${pool.id}`}>Edit pool</Link>
            </Button>
          }
        >
          <PoolTable stats={dist.stats} back={`/admin/economy/pools/${pool.id}`} showObserved={false} fiat={fiat} />
        </AdminCard>
      )}
      <AdminCard title="Recent unlocks" bodyClassName="p-0">
        <DataTable
          rows={recent}
          rowKey={(r) => r.v.id}
          empty="Nobody has unlocked this vault yet"
          columns={[
            { key: "t", header: "Time", cell: (r) => formatDateTime(r.v.createdAt) },
            { key: "u", header: "Player", cell: (r) => <UserLink id={r.v.userId} name={r.name} email={r.email} /> },
            { key: "r", header: "Rewards", cell: (r) => `${r.v.rewards.length} granted` },
            { key: "c", header: "Consumed", cell: (r) => `${r.v.consumed.length} items` },
          ]}
        />
      </AdminCard>
      <AdminCard title="Vault settings">
        <ResourceEditor resource="vaults" id={id} back={back} />
      </AdminCard>
    </AdminPage>
  );
}
