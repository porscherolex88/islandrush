import { sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard, HBarList } from "@/components/admin/charts";
import { AdminCard, AdminPage, DataTable } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Deposit levels" };

export default async function DepositLevelsPage() {
  const fiat = await getFiatDisplay();
  await requireAdmin("progression.manage");
  const [levels, unassigned] = await Promise.all([
    rows<{ id: string; name: string; sort_order: number; threshold: string; color: string; benefits: string[]; can_withdraw: boolean; withdrawal_min: string | null; withdrawal_max_daily: string | null; players: number }>(sql`
      select l.*, (select count(*)::int from profiles p where p.deposit_level_id = l.id and p.role = 'USER') as players
      from deposit_levels l order by l.sort_order`),
    rows<{ n: number }>(sql`select count(*)::int as n from profiles where deposit_level_id is null and role = 'USER'`),
  ]);
  const back = encodeURIComponent("/admin/progression/deposit-levels");
  return (
    <AdminPage
      title="Deposit levels"
      description="Levels are based on lifetime approved deposits and recalculated automatically when deposits are approved or reversed."
      actions={
        <Button asChild>
          <Link href={`/admin/manage/depositLevels/new?back=${back}`}>
            <Plus /> Add level
          </Link>
        </Button>
      }
    >
      <AdminCard title="Thresholds and benefits" bodyClassName="p-0">
        <DataTable
          rows={levels}
          rowKey={(l) => l.id}
          columns={[
            {
              key: "n",
              header: "Level",
              cell: (l) => (
                <Link href={`/admin/manage/depositLevels/${l.id}?back=${back}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
                  <span className="size-3 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </Link>
              ),
            },
            { key: "t", header: "Lifetime deposits", align: "right", cell: (l) => `${formatCash(l.threshold, { currency: fiat })}+` },
            { key: "w", header: "Withdrawals", cell: (l) => (l.can_withdraw ? `Min ${l.withdrawal_min ? formatCash(l.withdrawal_min, { currency: fiat }) : "default"} · daily ${l.withdrawal_max_daily ? formatCash(l.withdrawal_max_daily, { currency: fiat }) : "default"}` : "Not allowed") },
            { key: "b", header: "Benefits", cell: (l) => <span className="text-xs text-muted-foreground">{l.benefits.join(", ") || "-"}</span> },
            { key: "p", header: "Players", align: "right", cell: (l) => l.players },
          ]}
        />
      </AdminCard>
      <ChartCard title="Player distribution">
        <HBarList data={[...levels.map((l) => ({ label: l.name, value: l.players })), ...(unassigned[0]?.n ? [{ label: "No level", value: unassigned[0].n }] : [])]} />
      </ChartCard>
    </AdminPage>
  );
}
