import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, DataTable } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Completion rewards" };

export default async function CompletionRewardsPage() {
  await requireAdmin("collections.manage");
  const [cols, fragments] = await Promise.all([
    rows<{ id: string; name: string; icon: string; status: string; pool_id: string | null; pool: string | null; entries: number; items: number; completions: number }>(sql`
      select c.id, c.name, c.icon, c.status::text, p.id as pool_id, p.name as pool,
        (select count(*)::int from reward_pool_entries e where e.pool_id = p.id and e.active) as entries,
        (select count(*)::int from items i where i.collection_id = c.id and i.status = 'PUBLISHED') as items,
        (select count(*)::int from collection_completions cc where cc.collection_id = c.id) as completions
      from collections c left join reward_pools p on p.id = c.completion_reward_pool_id
      order by c.sort_order, c.name`),
    rows<{ id: string; name: string; icon: string; target_id: string | null; target: string | null; required: number | null; auto: boolean; assembled: number }>(sql`
      select f.id, f.name, f.icon, t.id as target_id, t.name as target, f.fragments_required as required, f.auto_assemble as auto,
        coalesce((select sum(ie.delta)::int from inventory_events ie where ie.item_id = t.id and ie.source_type = 'assembly' and ie.source_id = f.id::text and ie.delta > 0), 0) as assembled
      from items f left join items t on t.id = f.assembles_into_item_id
      where f.kind = 'FRAGMENT' order by f.name`),
  ]);
  return (
    <AdminPage title="Completion rewards" description="What players earn for completing collections and assembling fragments.">
      <AdminCard title="Collection completion rewards" bodyClassName="p-0">
        <DataTable
          rows={cols}
          rowKey={(c) => c.id}
          columns={[
            { key: "n", header: "Collection", cell: (c) => <Link href={`/admin/collections/${c.id}`} className="font-medium text-primary hover:underline">{c.icon} {c.name}</Link> },
            { key: "i", header: "Items", align: "right", cell: (c) => c.items },
            {
              key: "p",
              header: "Reward pool",
              cell: (c) =>
                c.pool_id ? (
                  <Link href={`/admin/economy/pools/${c.pool_id}`} className="text-primary hover:underline">
                    {c.pool} ({c.entries} entries)
                  </Link>
                ) : (
                  <span className="text-amber-600">No reward configured</span>
                ),
            },
            { key: "c", header: "Completions", align: "right", cell: (c) => c.completions },
            { key: "s", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
          ]}
        />
      </AdminCard>
      <AdminCard title="Fragment assembly" bodyClassName="p-0">
        <DataTable
          rows={fragments}
          rowKey={(f) => f.id}
          empty="No fragments configured"
          columns={[
            { key: "n", header: "Fragment", cell: (f) => <Link href={`/admin/manage/items/${f.id}?back=/admin/collections/rewards`} className="font-medium text-primary hover:underline">{f.icon} {f.name}</Link> },
            { key: "t", header: "Assembles into", cell: (f) => (f.target_id ? <Link href={`/admin/manage/items/${f.target_id}?back=/admin/collections/rewards`} className="hover:underline">{f.target}</Link> : <span className="text-amber-600">Not set</span>) },
            { key: "r", header: "Required", align: "right", cell: (f) => f.required ?? "-" },
            { key: "a", header: "Auto", cell: (f) => (f.auto ? "Yes" : "No") },
            { key: "x", header: "Assembled", align: "right", cell: (f) => f.assembled },
          ]}
        />
      </AdminCard>
    </AdminPage>
  );
}
