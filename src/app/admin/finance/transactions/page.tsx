import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, ChartCard } from "@/components/admin/charts";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, UserLink, pageOf, str, type Column } from "@/components/admin/ui";
import { db } from "@/db";
import { ledgerTransactions, ledgerTxTypeEnum, profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { rows as sqlRows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Transactions" };
const PAGE = 50;

export default async function TransactionsPage({ searchParams }: PageProps<"/admin/finance/transactions">) {
  await requireAdmin("finance.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const conds: SQL[] = [];
  const type = str(sp.type);
  if (type && (ledgerTxTypeEnum.enumValues as readonly string[]).includes(type)) conds.push(eq(ledgerTransactions.type, type as "DEPOSIT"));
  const user = str(sp.user)?.trim();
  if (user) conds.push(user.includes("@") ? sql`${ledgerTransactions.userId} = (select id from profiles where email = ${user.toLowerCase()})` : eq(ledgerTransactions.userId, user));
  const from = str(sp.from);
  if (from) conds.push(gte(ledgerTransactions.createdAt, new Date(`${from}T00:00:00+08:00`)));
  const to = str(sp.to);
  if (to) conds.push(lte(ledgerTransactions.createdAt, new Date(`${to}T23:59:59+08:00`)));

  const [list, byType] = await Promise.all([
    db
      .select({
        t: ledgerTransactions,
        name: profiles.name,
        email: profiles.email,
        myr: sql<string>`(select coalesce(sum(amount) filter (where amount > 0 and currency = 'MYR'), 0) from ledger_entries e where e.transaction_id = ${ledgerTransactions.id})`,
        credits: sql<string>`(select coalesce(sum(amount) filter (where amount > 0 and currency = 'CREDITS'), 0) from ledger_entries e where e.transaction_id = ${ledgerTransactions.id})`,
      })
      .from(ledgerTransactions)
      .leftJoin(profiles, eq(profiles.id, ledgerTransactions.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(ledgerTransactions.createdAt))
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE),
    sqlRows<{ type: string; n: number }>(sql`select type::text, count(*)::int as n from ledger_transactions where created_at > now() - interval '30 days' group by 1 order by 2 desc`),
  ]);
  const data = list.slice(0, PAGE);
  type Row = (typeof data)[number];
  const columns: Column<Row>[] = [
    { key: "at", header: "When", cell: (r) => <span className="text-xs whitespace-nowrap">{formatDateTime(r.t.createdAt)}</span> },
    { key: "type", header: "Type", cell: (r) => <Link href={`/admin/finance/ledger/${r.t.id}`} className="font-medium text-primary hover:underline">{r.t.type.replace(/_/g, " ")}</Link> },
    { key: "user", header: "User", cell: (r) => (r.t.userId ? <UserLink id={r.t.userId} name={r.name} email={r.email} /> : "System") },
    { key: "desc", header: "Description", cell: (r) => <span className="line-clamp-1 text-xs">{r.t.description}</span> },
    { key: "myr", header: "RM moved", align: "right", cell: (r) => (Number(r.myr) ? `RM${Number(r.myr).toLocaleString("en-MY", { minimumFractionDigits: 2 })}` : "-") },
    { key: "cr", header: "Credits moved", align: "right", cell: (r) => (Number(r.credits) ? Number(r.credits).toLocaleString("en-MY") : "-") },
    { key: "src", header: "Source", cell: (r) => <span className="text-xs text-muted-foreground">{r.t.sourceType ?? "-"}</span> },
  ];
  return (
    <AdminPage title="Transactions" description="Ledger transaction headers. Open one to see its balanced entries and related source record.">
      <ChartCard title="Transactions by type (30 days)">
        <BarChart data={byType.map((t) => ({ label: t.type.replace(/_/g, " "), value: t.n }))} height={120} />
      </ChartCard>
      <FilterBar basePath="/admin/finance/transactions">
        <FilterSelect name="type" label="Type" value={type} options={ledgerTxTypeEnum.enumValues} />
        <FilterInput name="user" label="User ID or email" value={user} />
        <FilterInput name="from" label="From" type="date" value={from} />
        <FilterInput name="to" label="To" type="date" value={to} />
      </FilterBar>
      <DataTable rows={data} columns={columns} rowKey={(r) => r.t.id} empty="No transactions match" />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/finance/transactions" />
    </AdminPage>
  );
}
