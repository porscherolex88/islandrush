import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdjustmentForm } from "@/components/admin/finance-forms";
import { AdminCard, AdminPage, DataTable, UserLink, str } from "@/components/admin/ui";
import { db } from "@/db";
import { ledgerTransactions, profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Adjustments" };

export default async function AdjustmentsPage({ searchParams }: PageProps<"/admin/finance/adjustments">) {
  await requireAdmin("ledger.adjust");
  const sp = await searchParams;
  const recent = await db
    .select({
      t: ledgerTransactions,
      name: profiles.name,
      email: profiles.email,
      by: sql<string | null>`(select name from profiles a where a.id = ${ledgerTransactions.createdBy})`,
      line: sql<{ account: string; amount: string } | null>`(select json_build_object('account', account_type, 'amount', amount) from ledger_entries e where e.transaction_id = ${ledgerTransactions.id} and e.user_id is not null limit 1)`,
    })
    .from(ledgerTransactions)
    .leftJoin(profiles, eq(profiles.id, ledgerTransactions.userId))
    .where(eq(ledgerTransactions.type, "ADJUSTMENT"))
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(50);

  return (
    <AdminPage title="Manual adjustments" description="Credit or debit a user's balance with a new balanced ledger transaction. Existing history is never edited.">
      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <AdminCard title="New adjustment" description="Requires a recent sign-in. Protected against double submission.">
          <AdjustmentForm defaultUserId={str(sp.userId) ?? ""} />
        </AdminCard>
        <AdminCard title="Recent adjustments" bodyClassName="p-0">
          <DataTable
            rows={recent}
            rowKey={(r) => r.t.id}
            empty="No adjustments yet"
            columns={[
              { key: "at", header: "When", cell: (r) => <Link href={`/admin/finance/ledger/${r.t.id}`} className="text-xs whitespace-nowrap text-primary hover:underline">{formatDateTime(r.t.createdAt)}</Link> },
              { key: "u", header: "User", cell: (r) => (r.t.userId ? <UserLink id={r.t.userId} name={r.name} email={r.email} /> : "-") },
              { key: "l", header: "Change", align: "right", cell: (r) => (r.line ? `${r.line.account} ${Number(r.line.amount) > 0 ? "+" : ""}${r.line.amount}` : "-") },
              { key: "d", header: "Reason", cell: (r) => <span className="line-clamp-2 text-xs">{r.t.description.replace(/^Manual adjustment: /, "")}</span> },
              { key: "b", header: "By", cell: (r) => <span className="text-xs">{r.by ?? "-"}</span> },
            ]}
          />
        </AdminCard>
      </div>
    </AdminPage>
  );
}
