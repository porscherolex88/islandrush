import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, ChartCard, HBarList } from "@/components/admin/charts";
import { AdminCard, AdminPage, FilterBar, FilterInput, StatGrid, StatsCard } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { inRange, one, parseRange, rows } from "@/server/admin/queries";
import { getConfig } from "@/server/services/config";
import { humanize } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Economy" };

export default async function EconomyPage({ searchParams }: PageProps<"/admin/economy">) {
  const fiat = await getFiatDisplay();
  await requireAdmin("economy.manage");
  const r = parseRange(await searchParams);
  const [conversion, supply, flows, spendByGame, rewardTypes, daily] = await Promise.all([
    getConfig("conversion"),
    one<{ credits: string; holders: number; users: number; pending: string; withdrawable: string; cash: string }>(sql`
      select
        coalesce(sum(balance) filter (where type = 'CREDITS'), 0) as credits,
        count(*) filter (where type = 'CREDITS' and balance > 0)::int as holders,
        (select count(*)::int from profiles where role = 'USER') as users,
        coalesce(sum(balance) filter (where type = 'PENDING_REWARDS'), 0) as pending,
        coalesce(sum(balance) filter (where type = 'WITHDRAWABLE'), 0) as withdrawable,
        coalesce(sum(balance) filter (where type = 'CASH'), 0) as cash
      from financial_accounts where user_id is not null`),
    one<{ converted_cash: string; converted_credits: string; spend: string; reward_credits: string; cash_rewards: string; referral: string; conversions: number }>(sql`
      select
        (select coalesce(sum(cash_amount), 0) from conversions where ${inRange(sql`created_at`, r)}) as converted_cash,
        (select coalesce(sum(credits), 0) from conversions where ${inRange(sql`created_at`, r)}) as converted_credits,
        (select count(*)::int from conversions where ${inRange(sql`created_at`, r)}) as conversions,
        (select coalesce(-sum(e.amount), 0) from ledger_entries e join ledger_transactions t on t.id = e.transaction_id where t.type = 'GAME_SPEND' and e.user_id is not null and ${inRange(sql`e.created_at`, r)}) as spend,
        (select coalesce(sum(e.amount), 0) from ledger_entries e join ledger_transactions t on t.id = e.transaction_id where t.type = 'GAME_REWARD_CREDITS' and e.user_id is not null and ${inRange(sql`e.created_at`, r)}) as reward_credits,
        (select coalesce(sum(amount), 0) from cash_rewards where source = 'GAME_REWARD' and status <> 'REVERSED' and ${inRange(sql`created_at`, r)}) as cash_rewards,
        (select coalesce(sum(amount), 0) from cash_rewards where source::text like 'REFERRAL%' and status <> 'REVERSED' and ${inRange(sql`created_at`, r)}) as referral`),
    rows<{ source: string; total: string }>(sql`
      select coalesce(t.source_type, 'other') as source, coalesce(-sum(e.amount), 0)::text as total
      from ledger_entries e join ledger_transactions t on t.id = e.transaction_id
      where t.type = 'GAME_SPEND' and e.user_id is not null and ${inRange(sql`e.created_at`, r)}
      group by 1 order by 2 desc`),
    rows<{ type: string; n: number }>(sql`
      select coalesce(reward->>'type', 'unknown') as type, count(*)::int as n from (
        select reward from mystery_box_plays where ${inRange(sql`created_at`, r)}
        union all select reward from tile_discoveries where ${inRange(sql`created_at`, r)}
        union all select reward from daily_spins where ${inRange(sql`created_at`, r)}
      ) x group by 1 order by 2 desc`),
    rows<{ d: string; v: number }>(sql`
      select (e.created_at at time zone 'Asia/Kuala_Lumpur')::date::text as d, coalesce(-sum(e.amount), 0)::float as v
      from ledger_entries e join ledger_transactions t on t.id = e.transaction_id
      where t.type = 'GAME_SPEND' and e.user_id is not null and ${inRange(sql`e.created_at`, r)} group by 1 order by 1`),
  ]);
  const perUser = supply.users ? Number(supply.credits) / supply.users : 0;
  const rmPerCredit = Number(conversion.cash) / conversion.credits;
  const SOURCE_LABEL: Record<string, string> = { mystery_box_play: "Mystery Box", tile_discovery: "Map discoveries", daily_event: "Mystery events" };

  return (
    <AdminPage
      title="Economy control center"
      description={`${r.from} to ${r.to}`}
      actions={
        <FilterBar basePath="/admin/economy">
          <FilterInput name="from" label="From" type="date" value={r.from} />
          <FilterInput name="to" label="To" type="date" value={r.to} />
        </FilterBar>
      }
    >
      <AdminCard
        title="Cash to Credit conversion"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/economy/settings/conversion">Change rate</Link>
          </Button>
        }
      >
        <p className="font-heading text-3xl font-bold">
          {formatCash(conversion.cash, { currency: fiat })} = {formatCredits(conversion.credits)} Credits
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          1 Credit = {formatCash(rmPerCredit.toFixed(5), { currency: fiat })} · {formatCash("1", { currency: fiat })} = {formatCredits(Math.round(conversion.credits / Number(conversion.cash)))} Credits
        </p>
      </AdminCard>
      <StatGrid cols={4}>
        <StatsCard label="Credit supply (outstanding)" value={formatCredits(supply.credits)} hint={`≈ ${formatCash(String((Number(supply.credits) * rmPerCredit).toFixed(2)), { currency: fiat })}`} />
        <StatsCard label="Credits per user" value={formatCredits(Math.round(perUser))} hint={`${supply.holders} holders of ${supply.users} users`} />
        <StatsCard label="Credits purchased" value={formatCredits(flows.converted_credits)} hint={`${formatCash(flows.converted_cash, { currency: fiat })} in ${flows.conversions} conversions`} />
        <StatsCard label="Credits consumed (game spend)" value={formatCredits(flows.spend)} />
        <StatsCard label="Credits issued as rewards" value={formatCredits(flows.reward_credits)} />
        <StatsCard label="Cash rewards issued" value={formatCash(flows.cash_rewards, { currency: fiat })} />
        <StatsCard label="Referral rewards" value={formatCash(flows.referral, { currency: fiat })} />
        <StatsCard label="Pending / withdrawable" value={formatCash(supply.pending, { currency: fiat })} hint={`Withdrawable ${formatCash(supply.withdrawable, { currency: fiat })}`} tone="brand" />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Daily Credit consumption">
            <BarChart data={daily.map((d) => ({ label: d.d.slice(5), value: d.v }))} format={(n) => `${formatCredits(Math.round(n))} Cr`} />
          </ChartCard>
        </div>
        <ChartCard title="Game spend by game">
          <HBarList data={spendByGame.map((s) => ({ label: SOURCE_LABEL[s.source] ?? humanize(s.source), value: Number(s.total) }))} format={(n) => `${formatCredits(n)} Cr`} />
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Reward issuance by type" description="Boxes, map discoveries and daily spins in range">
          <HBarList data={rewardTypes.map((t) => ({ label: t.type, value: t.n }))} />
        </ChartCard>
        <AdminCard title="Configure">
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["Conversion rate", "/admin/economy/settings/conversion"],
              ["Mystery Box and map pricing", "/admin/economy/pricing"],
              ["Reward pools and odds", "/admin/manage/pools"],
              ["Vault requirements", "/admin/manage/vaults"],
              ["Daily reward values", "/admin/economy/settings/daily_defaults"],
              ["Withdrawal limits", "/admin/economy/settings/withdrawal"],
              ["Deposit rules", "/admin/economy/settings/deposit"],
              ["Deposit Level thresholds", "/admin/progression/deposit-levels"],
              ["Referral rules", "/admin/economy/settings/referral"],
              ["Reward settlement", "/admin/economy/settings/rewards"],
              ["Game limits", "/admin/economy/settings/limits"],
            ].map(([l, h]) => (
              <li key={h}>
                <Link href={h} className="block rounded-lg border px-3 py-2 hover:bg-muted/50">
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
    </AdminPage>
  );
}
