import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DataTable, FilterBar, FilterInput, Pagination, StatGrid, StatsCard, UserLink, pageOf, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { one, rows } from "@/server/admin/queries";
import { getConfig } from "@/server/services/config";

export const metadata: Metadata = { title: "Qualifying deposits" };
const PAGE = 50;

export default async function QualifyingPage({ searchParams }: PageProps<"/admin/referrals/qualifying">) {
  await requireAdmin("referrals.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const cfg = await getConfig("referral");
  const q = str(sp.q)?.trim();
  const from = str(sp.from);
  const to = str(sp.to);
  const like = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const where = sql`
    d.status in ('APPROVED', 'REVERSED') and referee.referred_by_id is not null
    and exists (select 1 from cash_rewards cr where cr.deposit_id = d.id)
    ${like ? sql`and (referee.email ilike ${like} or referee.name ilike ${like} or referrer.email ilike ${like} or referrer.name ilike ${like} or d.reference ilike ${like})` : sql``}
    ${from ? sql`and d.reviewed_at >= ${new Date(`${from}T00:00:00+08:00`)}` : sql``}
    ${to ? sql`and d.reviewed_at <= ${new Date(`${to}T23:59:59+08:00`)}` : sql``}`;
  const [list, summary] = await Promise.all([
    rows<{
      id: string;
      amount: string;
      status: string;
      reviewed_at: string | null;
      referee_id: string;
      referee_name: string;
      referee_email: string;
      referrer_id: string;
      referrer_name: string;
      referrer_email: string;
      rewards: string;
      levels: number;
      held: number;
    }>(sql`
      select d.id, d.amount::text, d.status::text, d.reviewed_at::text,
        referee.id as referee_id, referee.name as referee_name, referee.email as referee_email,
        referrer.id as referrer_id, referrer.name as referrer_name, referrer.email as referrer_email,
        (select coalesce(sum(amount), 0)::text from cash_rewards cr where cr.deposit_id = d.id and cr.status <> 'REVERSED') as rewards,
        (select count(*)::int from cash_rewards cr where cr.deposit_id = d.id) as levels,
        (select count(*)::int from cash_rewards cr where cr.deposit_id = d.id and cr.status = 'HELD') as held
      from deposits d
      join profiles referee on referee.id = d.user_id
      join profiles referrer on referrer.id = referee.referred_by_id
      where ${where}
      order by d.reviewed_at desc nulls last
      limit ${PAGE + 1} offset ${(page - 1) * PAGE}`),
    one<{ n: number; volume: string; rewards: string }>(sql`
      select count(*)::int as n, coalesce(sum(d.amount), 0)::text as volume,
        (select coalesce(sum(amount), 0)::text from cash_rewards where source::text like 'REFERRAL%' and status <> 'REVERSED') as rewards
      from deposits d join profiles referee on referee.id = d.user_id
      where d.status = 'APPROVED' and referee.referred_by_id is not null and exists (select 1 from cash_rewards cr where cr.deposit_id = d.id)`),
  ]);
  const shown = list.slice(0, PAGE);

  return (
    <AdminPage title="Qualifying deposits" description={`A referee's first approved deposit of at least ${formatMYR(cfg.qualifyingDepositMin)} pays rewards up to ${cfg.levels} levels.`}>
      <StatGrid cols={3}>
        <StatsCard label="Qualifying deposits" value={summary.n} />
        <StatsCard label="Qualifying volume" value={formatMYR(summary.volume)} />
        <StatsCard label="Referral rewards (active)" value={formatMYR(summary.rewards)} href="/admin/referrals/rewards" />
      </StatGrid>
      <FilterBar basePath="/admin/referrals/qualifying">
        <FilterInput name="q" label="Search" value={q} placeholder="Referee, referrer, reference" />
        <FilterInput name="from" label="From" type="date" value={from} />
        <FilterInput name="to" label="To" type="date" value={to} />
      </FilterBar>
      <DataTable
        rows={shown}
        rowKey={(r) => r.id}
        empty="No qualifying deposits yet"
        columns={[
          { key: "t", header: "Approved", cell: (r) => <Link href={`/admin/finance/deposits/${r.id}`} className="whitespace-nowrap text-primary hover:underline">{r.reviewed_at ? formatDateTime(r.reviewed_at) : "-"}</Link> },
          { key: "e", header: "Referee", cell: (r) => <UserLink id={r.referee_id} name={r.referee_name} email={r.referee_email} /> },
          { key: "r", header: "Direct referrer", cell: (r) => <UserLink id={r.referrer_id} name={r.referrer_name} email={r.referrer_email} /> },
          { key: "a", header: "Deposit", align: "right", cell: (r) => formatMYR(r.amount) },
          { key: "rw", header: "Rewards paid", align: "right", cell: (r) => `${formatMYR(r.rewards)} (${r.levels} lvl)` },
          { key: "h", header: "Held", align: "right", cell: (r) => (r.held ? <span className="text-amber-600">{r.held}</span> : "0") },
          { key: "s", header: "Deposit status", cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/referrals/qualifying" />
    </AdminPage>
  );
}
