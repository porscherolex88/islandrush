import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/actions";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, StatGrid, StatsCard, UserLink, pageOf, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime } from "@/lib/time";
import { cashRewardAction } from "@/server/actions/admin/ops";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Referral rewards" };
const PAGE = 50;
const STATUSES = ["PENDING", "HELD", "SETTLED", "REVERSED"] as const;

export default async function ReferralRewardsPage({ searchParams }: PageProps<"/admin/referrals/rewards">) {
  const fiat = await getFiatDisplay();
  const admin = await requireAdmin("referrals.view");
  const canManage = admin.can("risk.manage");
  const sp = await searchParams;
  const page = pageOf(sp);
  const status = str(sp.status);
  const level = str(sp.level);
  const q = str(sp.q)?.trim();
  const like = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const where = sql`
    cr.source::text like 'REFERRAL%'
    ${status && STATUSES.includes(status as never) ? sql`and cr.status = ${status}::cash_reward_status` : sql``}
    ${level && /^[123]$/.test(level) ? sql`and cr.referral_level = ${Number(level)}` : sql``}
    ${like ? sql`and (u.email ilike ${like} or u.name ilike ${like} or e.email ilike ${like} or e.name ilike ${like})` : sql``}`;
  const [list, summary] = await Promise.all([
    rows<{ id: string; amount: string; status: string; level: number; created_at: string; settle_after: string; held_reason: string | null; user_id: string; name: string; email: string; referee_id: string | null; referee_name: string | null; referee_email: string | null }>(sql`
      select cr.id, cr.amount::text, cr.status::text, cr.referral_level as level, cr.created_at::text, cr.settle_after::text, cr.held_reason,
        u.id as user_id, u.name, u.email, e.id as referee_id, e.name as referee_name, e.email as referee_email
      from cash_rewards cr join profiles u on u.id = cr.user_id left join profiles e on e.id = cr.referee_id
      where ${where}
      order by cr.created_at desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`),
    one<{ pending: string; held: string; settled: string; reversed: string; held_n: number }>(sql`
      select coalesce(sum(amount) filter (where status = 'PENDING'), 0)::text as pending,
        coalesce(sum(amount) filter (where status = 'HELD'), 0)::text as held,
        count(*) filter (where status = 'HELD')::int as held_n,
        coalesce(sum(amount) filter (where status = 'SETTLED'), 0)::text as settled,
        coalesce(sum(amount) filter (where status = 'REVERSED'), 0)::text as reversed
      from cash_rewards where source::text like 'REFERRAL%'`),
  ]);
  const shown = list.slice(0, PAGE);

  return (
    <AdminPage title="Referral rewards" description="Pending rewards settle automatically after the holding period unless held for review.">
      <StatGrid cols={4}>
        <StatsCard label="Pending" value={formatCash(summary.pending, { currency: fiat })} />
        <StatsCard label="Held for review" value={formatCash(summary.held, { currency: fiat })} hint={`${summary.held_n} rewards`} tone={summary.held_n ? "warning" : "default"} href="/admin/referrals/rewards?status=HELD" />
        <StatsCard label="Settled" value={formatCash(summary.settled, { currency: fiat })} tone="success" />
        <StatsCard label="Reversed" value={formatCash(summary.reversed, { currency: fiat })} />
      </StatGrid>
      <FilterBar basePath="/admin/referrals/rewards">
        <FilterSelect name="status" label="Status" value={status} options={STATUSES} />
        <FilterSelect name="level" label="Level" value={level} options={[{ value: "1", label: "Level 1" }, { value: "2", label: "Level 2" }, { value: "3", label: "Level 3" }]} />
        <FilterInput name="q" label="Search" value={q} placeholder="Referrer or referee" />
      </FilterBar>
      <DataTable
        rows={shown}
        rowKey={(r) => r.id}
        empty="No referral rewards match"
        columns={[
          { key: "t", header: "Created", cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.created_at)}</span> },
          { key: "u", header: "Referrer", cell: (r) => <UserLink id={r.user_id} name={r.name} email={r.email} /> },
          { key: "e", header: "Referee", cell: (r) => (r.referee_id ? <UserLink id={r.referee_id} name={r.referee_name} email={r.referee_email} /> : "-") },
          { key: "l", header: "Level", align: "right", cell: (r) => `L${r.level}` },
          { key: "a", header: "Amount", align: "right", cell: (r) => <span className="font-semibold">{formatCash(r.amount, { currency: fiat })}</span> },
          { key: "s", header: "Status", cell: (r) => <div><StatusBadge status={r.status} />{r.held_reason && <p className="mt-0.5 text-xs text-muted-foreground">{r.held_reason}</p>}</div> },
          { key: "sa", header: "Settles", cell: (r) => (r.status === "PENDING" ? <span className="text-xs">{formatDateTime(r.settle_after)}</span> : "-") },
          ...(canManage
            ? [
                {
                  key: "x",
                  header: "",
                  cell: (r: (typeof shown)[number]) => (
                    <div className="flex justify-end gap-1">
                      {r.status === "PENDING" && (
                        <ActionButton action={cashRewardAction} args={[r.id, "hold"]} variant="outline" success="Reward held" confirm={{ title: "Hold this reward?", reasonLabel: "Reason" }}>
                          Hold
                        </ActionButton>
                      )}
                      {r.status === "HELD" && (
                        <ActionButton action={cashRewardAction} args={[r.id, "release"]} variant="outline" success="Reward released" confirm={{ title: "Release this reward?", description: "It returns to pending and settles on schedule.", reasonLabel: "Reason" }}>
                          Release
                        </ActionButton>
                      )}
                      {(r.status === "PENDING" || r.status === "HELD") && (
                        <ActionButton action={cashRewardAction} args={[r.id, "reverse"]} success="Reward reversed" confirm={{ title: "Reverse this reward?", description: "The pending amount is removed from the referrer through the ledger.", reasonLabel: "Reason", destructive: true, confirmLabel: "Reverse" }}>
                          Reverse
                        </ActionButton>
                      )}
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/referrals/rewards" />
    </AdminPage>
  );
}
