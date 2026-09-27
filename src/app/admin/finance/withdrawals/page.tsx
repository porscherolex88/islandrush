import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, StatGrid, StatsCard, UserLink, pageOf, str, type Column } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { profiles, withdrawals } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Withdrawals" };
const PAGE = 50;
const STATUSES = ["PENDING", "REVIEW", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"] as const;
const QUEUES: Record<string, (typeof STATUSES)[number][]> = {
  open: ["PENDING", "REVIEW", "APPROVED", "PROCESSING"],
  pending: ["PENDING"],
  review: ["REVIEW"],
  payout: ["APPROVED", "PROCESSING"],
};

export default async function WithdrawalsPage({ searchParams }: PageProps<"/admin/finance/withdrawals">) {
  await requireAdmin("finance.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const queue = str(sp.queue) ?? (str(sp.status) ? undefined : "open");
  const status = str(sp.status);
  const conds: SQL[] = [];
  if (queue && QUEUES[queue]) conds.push(inArray(withdrawals.status, QUEUES[queue]));
  else if (status && STATUSES.includes(status as never)) conds.push(eq(withdrawals.status, status as (typeof STATUSES)[number]));
  const q = str(sp.q)?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    conds.push(or(ilike(profiles.email, like), ilike(profiles.name, like), ilike(withdrawals.payoutReference, like), sql`${withdrawals.accountSnapshot}->>'accountNumber' ilike ${like}`)!);
  }
  const from = str(sp.from);
  if (from) conds.push(gte(withdrawals.createdAt, new Date(`${from}T00:00:00+08:00`)));
  const to = str(sp.to);
  if (to) conds.push(lte(withdrawals.createdAt, new Date(`${to}T23:59:59+08:00`)));
  const sortCol = str(sp.sort) === "amount" ? withdrawals.amount : withdrawals.createdAt;
  const dir = str(sp.dir) ?? (queue ? "asc" : "desc");

  const [list, [sum]] = await Promise.all([
    db
      .select({
        w: withdrawals,
        name: profiles.name,
        email: profiles.email,
        hold: profiles.rewardsOnHold,
        flags: sql<number>`(select count(*)::int from risk_flags rf where rf.user_id = ${withdrawals.userId} and rf.status in ('OPEN','IN_REVIEW'))`,
      })
      .from(withdrawals)
      .innerJoin(profiles, eq(profiles.id, withdrawals.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(dir === "asc" ? asc(sortCol) : desc(sortCol))
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE),
    db
      .select({
        pending: sql<number>`count(*) filter (where status = 'PENDING')::int`,
        review: sql<number>`count(*) filter (where status = 'REVIEW')::int`,
        payout: sql<number>`count(*) filter (where status in ('APPROVED','PROCESSING'))::int`,
        openSum: sql<string>`coalesce(sum(amount) filter (where status in ('PENDING','REVIEW','APPROVED','PROCESSING')), 0)`,
      })
      .from(withdrawals),
  ]);
  const rows = list.slice(0, PAGE);
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: "at", header: "Requested", sortKey: "createdAt", cell: (r) => <Link href={`/admin/finance/withdrawals/${r.w.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">{formatDateTime(r.w.createdAt)}</Link> },
    { key: "user", header: "User", cell: (r) => <UserLink id={r.w.userId} name={r.name} email={r.email} /> },
    { key: "amt", header: "Amount", sortKey: "amount", align: "right", cell: (r) => <span className="font-semibold">{formatMYR(r.w.amount)}</span> },
    { key: "bank", header: "Bank account", cell: (r) => <span className="text-xs">{r.w.accountSnapshot.bankName} · {r.w.accountSnapshot.accountNumber}</span> },
    { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.w.status} /> },
    {
      key: "risk",
      header: "Risk",
      cell: (r) => (
        <div className="flex gap-1">
          {r.flags > 0 && <StatusBadge status="FLAG" tone="danger" label={`${r.flags} flag${r.flags > 1 ? "s" : ""}`} />}
          {r.hold && <StatusBadge status="HELD" label="Hold" />}
          {!r.flags && !r.hold && <span className="text-xs text-muted-foreground">Clear</span>}
        </div>
      ),
    },
  ];

  return (
    <AdminPage title="Withdrawals" description="Review, approve, process and complete payout requests.">
      <StatGrid cols={4}>
        <StatsCard label="Pending" value={sum.pending} href="/admin/finance/withdrawals?queue=pending" tone={sum.pending ? "warning" : "default"} />
        <StatsCard label="In review" value={sum.review} href="/admin/finance/withdrawals?queue=review" tone={sum.review ? "brand" : "default"} />
        <StatsCard label="Awaiting payout" value={sum.payout} href="/admin/finance/withdrawals?queue=payout" />
        <StatsCard label="Open value" value={formatMYR(sum.openSum)} />
      </StatGrid>
      <FilterBar basePath="/admin/finance/withdrawals">
        <FilterSelect name="queue" label="Queue" value={queue} options={[{ value: "open", label: "All open" }, { value: "pending", label: "Pending" }, { value: "review", label: "Review" }, { value: "payout", label: "Awaiting payout" }]} allLabel="Any" />
        <FilterSelect name="status" label="Status" value={status} options={STATUSES} />
        <FilterInput name="q" label="Search" value={q} placeholder="User, account no., payout ref" />
        <FilterInput name="from" label="From" type="date" value={from} />
        <FilterInput name="to" label="To" type="date" value={to} />
      </FilterBar>
      <DataTable rows={rows} columns={columns} sp={sp} basePath="/admin/finance/withdrawals" rowKey={(r) => r.w.id} empty="No withdrawals in this queue" />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/finance/withdrawals" />
    </AdminPage>
  );
}
