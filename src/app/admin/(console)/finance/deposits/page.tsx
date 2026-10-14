import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, StatGrid, StatsCard, UserLink, pageOf, str, type Column } from "@/components/admin/ui";
import { StatusBadge , humanize } from "@/components/shared/status-badge";
import { db } from "@/db";
import { deposits, profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime, relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Deposits" };
const PAGE = 50;
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "REVERSED"] as const;

export default async function DepositsPage({ searchParams }: PageProps<"/admin/finance/deposits">) {
  const fiat = await getFiatDisplay();
  await requireAdmin("finance.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const status = str(sp.status) ?? "PENDING";
  const conds: SQL[] = [];
  if (status !== "ALL" && STATUSES.includes(status as never)) conds.push(eq(deposits.status, status as (typeof STATUSES)[number]));
  const q = str(sp.q)?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    conds.push(or(ilike(deposits.reference, like), ilike(deposits.payerName, like), ilike(profiles.email, like), ilike(profiles.name, like))!);
  }
  const method = str(sp.method);
  if (method) conds.push(eq(deposits.method, method));
  const min = str(sp.min);
  if (min && /^\d+(\.\d+)?$/.test(min)) conds.push(gte(deposits.amount, min));
  const max = str(sp.max);
  if (max && /^\d+(\.\d+)?$/.test(max)) conds.push(lte(deposits.amount, max));
  const from = str(sp.from);
  if (from) conds.push(gte(deposits.createdAt, new Date(`${from}T00:00:00+08:00`)));
  const to = str(sp.to);
  if (to) conds.push(lte(deposits.createdAt, new Date(`${to}T23:59:59+08:00`)));
  const sortCol = str(sp.sort) === "amount" ? deposits.amount : deposits.createdAt;
  const dir = str(sp.dir) ?? (status === "PENDING" ? "asc" : "desc");

  const [list, [summary]] = await Promise.all([
    db
      .select({ d: deposits, name: profiles.name, email: profiles.email, reviewer: sql<string | null>`(select name from profiles r where r.id = ${deposits.reviewerId})` })
      .from(deposits)
      .innerJoin(profiles, eq(profiles.id, deposits.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(dir === "asc" ? asc(sortCol) : desc(sortCol))
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE),
    db
      .select({
        pending: sql<number>`count(*) filter (where status = 'PENDING')::int`,
        pendingSum: sql<string>`coalesce(sum(amount) filter (where status = 'PENDING'), 0)`,
        oldest: sql<Date | null>`min(created_at) filter (where status = 'PENDING')`,
        today: sql<string>`coalesce(sum(amount) filter (where status = 'APPROVED' and reviewed_at > now() - interval '24 hours'), 0)`,
      })
      .from(deposits),
  ]);
  const rows = list.slice(0, PAGE);
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: "at", header: "Submitted", sortKey: "createdAt", cell: (r) => <Link href={`/admin/finance/deposits/${r.d.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">{formatDateTime(r.d.createdAt)}</Link> },
    { key: "user", header: "User", cell: (r) => <UserLink id={r.d.userId} name={r.name} email={r.email} /> },
    { key: "amt", header: "Amount", sortKey: "amount", align: "right", cell: (r) => <span className="font-semibold">{formatCash(r.d.amount, { currency: fiat })}</span> },
    { key: "m", header: "Method", cell: (r) => humanize(r.d.method) },
    { key: "ref", header: "Reference", cell: (r) => <code className="text-xs">{r.d.reference}</code> },
    { key: "payer", header: "Payer", cell: (r) => r.d.payerName },
    { key: "proof", header: "Proof", cell: (r) => (r.d.proofFileId ? "Attached" : "-") },
    { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.d.status} /> },
    { key: "rev", header: "Reviewer", cell: (r) => <span className="text-xs text-muted-foreground">{r.reviewer ?? "-"}</span> },
  ];

  return (
    <AdminPage title="Deposits" description="Manual bank transfer deposits. Approving credits the user's Cash wallet through the ledger.">
      <StatGrid cols={4}>
        <StatsCard label="Pending" value={summary.pending} tone={summary.pending ? "warning" : "default"} href="/admin/finance/deposits" />
        <StatsCard label="Pending value" value={formatCash(summary.pendingSum, { currency: fiat })} />
        <StatsCard label="Oldest pending" value={summary.oldest ? relativeTime(new Date(summary.oldest)) : "-"} />
        <StatsCard label="Approved (24h)" value={formatCash(summary.today, { currency: fiat })} />
      </StatGrid>
      <FilterBar basePath="/admin/finance/deposits">
        <FilterSelect name="status" label="Status" value={status} options={[...STATUSES, { value: "ALL", label: "All statuses" }]} allLabel="Pending (default)" />
        <FilterInput name="q" label="Search" value={q} placeholder="Reference, payer, user" />
        <FilterSelect name="method" label="Method" value={method} options={["BANK_TRANSFER", "DUITNOW"]} />
        <FilterInput name="min" label="Min amount" value={min} className="w-24" />
        <FilterInput name="max" label="Max amount" value={max} className="w-24" />
        <FilterInput name="from" label="From" type="date" value={from} />
        <FilterInput name="to" label="To" type="date" value={to} />
      </FilterBar>
      <DataTable rows={rows} columns={columns} sp={sp} basePath="/admin/finance/deposits" rowKey={(r) => r.d.id} empty={status === "PENDING" ? "No deposits waiting for review" : "No deposits match"} />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/finance/deposits" />
    </AdminPage>
  );
}
