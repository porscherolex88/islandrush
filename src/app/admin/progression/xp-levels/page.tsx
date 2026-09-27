import { sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HBarList, ChartCard } from "@/components/admin/charts";
import { AdminCard, AdminPage, DataTable } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "XP levels" };

export default async function XpLevelsPage() {
  await requireAdmin("progression.manage");
  const [levels, rules] = await Promise.all([
    rows<{ level: number; title: string; xp_required: number; pool_id: string | null; pool: string | null; players: number }>(sql`
      select l.level, l.title, l.xp_required, p.id as pool_id, p.name as pool,
        (select count(*)::int from profiles pr where pr.xp_level = l.level and pr.role = 'USER') as players
      from xp_levels l left join reward_pools p on p.id = l.reward_pool_id order by l.level`),
    rows<{ source: string; label: string; xp: number; active: boolean; n: number; total: number }>(sql`
      select r.source, r.label, r.amount as xp, r.active, count(t.id)::int as n, coalesce(sum(t.amount), 0)::int as total
      from xp_rules r left join xp_transactions t on t.source = r.source and t.created_at > now() - interval '30 days'
      group by r.source order by total desc, r.source`),
  ]);
  const back = encodeURIComponent("/admin/progression/xp-levels");
  return (
    <AdminPage
      title="XP levels"
      description="XP is earned from play and never converts to cash. Levels unlock rewards and badges."
      actions={
        <Button asChild>
          <Link href={`/admin/manage/xpLevels/new?back=${back}`}>
            <Plus /> Add level
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <AdminCard title="Levels" bodyClassName="p-0">
          <DataTable
            rows={levels}
            rowKey={(l) => String(l.level)}
            columns={[
              { key: "l", header: "Level", cell: (l) => <Link href={`/admin/manage/xpLevels/${l.level}?back=${back}`} className="font-semibold text-primary hover:underline">{l.level}</Link> },
              { key: "t", header: "Title", cell: (l) => l.title },
              { key: "x", header: "XP required", align: "right", cell: (l) => l.xp_required.toLocaleString() },
              { key: "r", header: "Level-up reward", cell: (l) => (l.pool_id ? <Link href={`/admin/economy/pools/${l.pool_id}`} className="hover:underline">{l.pool}</Link> : <span className="text-muted-foreground">None</span>) },
              { key: "p", header: "Players", align: "right", cell: (l) => l.players },
            ]}
          />
        </AdminCard>
        <ChartCard title="Players by level">
          <HBarList data={levels.map((l) => ({ label: `Lv ${l.level} ${l.title}`, value: l.players }))} />
        </ChartCard>
      </div>
      <AdminCard
        title="XP rules (last 30 days)"
        bodyClassName="p-0"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/manage/xpRules">Edit rules</Link>
          </Button>
        }
      >
        <DataTable
          rows={rules}
          rowKey={(r) => r.source}
          columns={[
            { key: "s", header: "Source", cell: (r) => <Link href={`/admin/manage/xpRules/${r.source}?back=${back}`} className="text-primary hover:underline">{r.label}</Link> },
            { key: "x", header: "XP each", align: "right", cell: (r) => (r.active ? r.xp : "Off") },
            { key: "n", header: "Awards", align: "right", cell: (r) => r.n.toLocaleString() },
            { key: "t", header: "XP issued", align: "right", cell: (r) => r.total.toLocaleString() },
          ]}
        />
      </AdminCard>
    </AdminPage>
  );
}
