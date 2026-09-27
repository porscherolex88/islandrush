import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ReconciliationRunner } from "@/components/admin/finance-forms";
import { AdminCard, AdminPage, DataTable, StatGrid, StatsCard } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits, formatMYR } from "@/lib/money";
import { rows } from "@/server/admin/queries";
import { runReconciliation } from "@/server/services/admin-finance";

export const metadata: Metadata = { title: "Reconciliation" };

export default async function ReconciliationPage() {
  await requireAdmin("reconciliation.view");
  type Line = { type: string; currency: string; owner: string; total: string; n: number };
  const [checks, users, system] = await Promise.all([
    runReconciliation(),
    rows<Line>(sql`
      select type::text, currency::text, 'Users' as owner, sum(balance)::text as total, count(*)::int as n
      from financial_accounts where user_id is not null group by type, currency order by type`),
    rows<Line>(sql`
      select a.type::text, a.currency::text, 'System' as owner, coalesce(sum(e.amount), 0)::text as total, 1 as n
      from financial_accounts a left join ledger_entries e on e.account_id = a.id
      where a.user_id is null group by a.id, a.type, a.currency order by a.type`),
  ]);
  const list = [...users, ...system].map((l) => ({ ...l, total: Number(l.total) }));
  const fmt = (c: string, v: number) => (c === "CREDITS" ? `${formatCredits(Math.round(v))} Cr` : formatMYR(v.toFixed(2)));
  const failed = checks.filter((c) => !c.ok).length;

  return (
    <AdminPage title="Reconciliation" description="Integrity checks tie every subledger back to the double-entry ledger.">
      <StatGrid cols={3}>
        <StatsCard label="Checks" value={checks.length} />
        <StatsCard label="Passing" value={checks.length - failed} tone="success" />
        <StatsCard label="Failing" value={failed} tone={failed ? "danger" : "default"} />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <AdminCard title="Integrity checks">
          <ReconciliationRunner initial={checks} />
        </AdminCard>
        <AdminCard title="Account balances" description="User balances are summed from account rows. System balances are derived from ledger entries." bodyClassName="p-0">
          <DataTable
            rows={list}
            rowKey={(r) => `${r.owner}-${r.type}-${r.currency}`}
            columns={[
              { key: "o", header: "Owner", cell: (r) => r.owner },
              { key: "t", header: "Account", cell: (r) => <code className="text-xs">{r.type}</code> },
              { key: "n", header: "Accounts", align: "right", cell: (r) => r.n },
              { key: "v", header: "Balance", align: "right", cell: (r) => fmt(r.currency, r.total) },
            ]}
          />
        </AdminCard>
      </div>
    </AdminPage>
  );
}
