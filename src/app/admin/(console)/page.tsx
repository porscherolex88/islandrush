import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, ChartCard } from "@/components/admin/charts";
import { AdminCard, AdminPage, FilterBar, FilterInput, StatGrid, StatsCard } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { deposits, profiles, riskFlags, withdrawals } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { relativeTime } from "@/lib/time";
import { dailySeries, dashboardStats, parseRange } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const fiat = await getFiatDisplay();
  const rm = (v: string | number) => formatCash(Number(v).toFixed(2), { currency: fiat });
  const ctx = await requireAdmin("dashboard.view");
  const sp = await searchParams;
  const r = parseRange(sp);
  const finance = ctx.can("finance.view");
  const [s, users, dep, wd, boxes, dau, pendingDeposits, queue, flags] = await Promise.all([
    dashboardStats(r),
    dailySeries(r, "users"),
    finance ? dailySeries(r, "deposits") : Promise.resolve([]),
    finance ? dailySeries(r, "withdrawals") : Promise.resolve([]),
    dailySeries(r, "boxes"),
    dailySeries(r, "dau"),
    finance
      ? db.select({ id: deposits.id, amount: deposits.amount, createdAt: deposits.createdAt, name: profiles.name }).from(deposits).innerJoin(profiles, eq(profiles.id, deposits.userId)).where(eq(deposits.status, "PENDING")).orderBy(deposits.createdAt).limit(6)
      : Promise.resolve([]),
    finance
      ? db
          .select({ id: withdrawals.id, amount: withdrawals.amount, status: withdrawals.status, createdAt: withdrawals.createdAt, name: profiles.name })
          .from(withdrawals)
          .innerJoin(profiles, eq(profiles.id, withdrawals.userId))
          .where(inArray(withdrawals.status, ["PENDING", "REVIEW", "APPROVED", "PROCESSING"]))
          .orderBy(withdrawals.createdAt)
          .limit(6)
      : Promise.resolve([]),
    ctx.can("risk.view")
      ? db.select({ id: riskFlags.id, summary: riskFlags.summary, severity: riskFlags.severity, createdAt: riskFlags.createdAt }).from(riskFlags).where(inArray(riskFlags.status, ["OPEN", "IN_REVIEW"])).orderBy(desc(riskFlags.createdAt)).limit(6)
      : Promise.resolve([]),
  ]);

  return (
    <AdminPage
      title="Operations dashboard"
      description={`${r.from} to ${r.to} (${r.days} days, Malaysia time)`}
      actions={
        <FilterBar basePath="/admin">
          <FilterInput name="from" label="From" type="date" value={r.from} />
          <FilterInput name="to" label="To" type="date" value={r.to} />
        </FilterBar>
      }
    >
      <StatGrid cols={6}>
        <StatsCard label="Registered users" value={s.users.total.toLocaleString()} href="/admin/users" />
        <StatsCard label="New users" value={s.users.new.toLocaleString()} hint="In range" href="/admin/users?sort=createdAt" />
        <StatsCard label="Active users" value={s.users.active.toLocaleString()} hint="Seen in range" />
        <StatsCard label="Open risk flags" value={s.misc.risk_open} hint={`${s.misc.risk_high} high severity`} tone={s.misc.risk_high ? "danger" : "default"} href="/admin/risk/flags" />
        <StatsCard label="Open tickets" value={s.misc.tickets_open} href="/admin/support" tone={s.misc.tickets_open ? "warning" : "default"} />
        <StatsCard label="Referral rewards" value={rm(s.misc.referral_sum)} hint={`${s.misc.referral_count} rewards in range`} href="/admin/referrals/rewards" />
      </StatGrid>

      {finance && (
        <>
          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Finance</h2>
          <StatGrid cols={6}>
            <StatsCard label="Deposits today" value={rm(s.deposits.today)} hint={`Week ${rm(s.deposits.week)}`} />
            <StatsCard label="Deposits (30 days)" value={rm(s.deposits.month)} hint={`Range ${rm(s.deposits.range_sum)} · ${s.deposits.range_count} approved`} />
            <StatsCard label="Pending deposits" value={s.deposits.pending_count} hint={rm(s.deposits.pending_sum)} tone={s.deposits.pending_count ? "warning" : "default"} href="/admin/finance/deposits" />
            <StatsCard label="Withdrawals today" value={rm(s.withdrawals.today)} hint={`Week ${rm(s.withdrawals.week)} · 30d ${rm(s.withdrawals.month)}`} />
            <StatsCard label="Pending withdrawals" value={s.withdrawals.pending_count} hint={rm(s.withdrawals.pending_sum)} tone={s.withdrawals.pending_count ? "warning" : "default"} href="/admin/finance/withdrawals" />
            <StatsCard label="Withdrawable liability" value={rm(s.balances.withdrawable)} hint={`Pending rewards ${rm(s.balances.pending)}`} tone="brand" href="/admin/finance/reconciliation" />
          </StatGrid>
        </>
      )}

      <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Economy and games</h2>
      <StatGrid cols={6}>
        <StatsCard label="Credits issued" value={formatCredits(s.credits.issued)} hint="In range" />
        <StatsCard label="Credits consumed" value={formatCredits(s.credits.consumed)} hint="In range" />
        <StatsCard label="Outstanding Credits" value={formatCredits(s.balances.credits)} hint={`Cash wallets ${rm(s.balances.cash)}`} />
        <StatsCard label="Mystery Box opens" value={s.games.boxes.toLocaleString()} hint={`${s.games.spins} daily spins`} />
        <StatsCard label="Map discoveries" value={s.games.tiles.toLocaleString()} hint={`${s.games.areas} areas unlocked`} />
        <StatsCard label="Vaults / collections" value={`${s.games.vaults} / ${s.games.collections}`} hint="Unlocks / completions" />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="New users per day">
          <BarChart data={users} />
        </ChartCard>
        <ChartCard title="Daily active (check-ins)">
          <BarChart data={dau} color="oklch(0.65 0.15 160)" />
        </ChartCard>
        {finance && (
          <>
            <ChartCard title="Approved deposits">
              <BarChart data={dep} format={(n) => rm(n)} color="oklch(0.6 0.16 150)" />
            </ChartCard>
            <ChartCard title="Completed withdrawals">
              <BarChart data={wd} format={(n) => rm(n)} color="oklch(0.7 0.16 60)" />
            </ChartCard>
          </>
        )}
        <ChartCard title="Mystery Box opens">
          <BarChart data={boxes} color="oklch(0.55 0.2 300)" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {finance && (
          <AdminCard title="Oldest pending deposits" actions={<Link href="/admin/finance/deposits" className="text-xs font-medium text-primary">View all</Link>} bodyClassName="p-0">
            <ul className="divide-y text-sm">
              {pendingDeposits.length === 0 && <li className="p-4 text-muted-foreground">Queue is clear</li>}
              {pendingDeposits.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/finance/deposits/${d.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40">
                    <span className="truncate">{d.name}</span>
                    <span className="text-right">
                      <span className="block font-medium tabular">{formatCash(d.amount, { currency: fiat })}</span>
                      <span className="block text-xs text-muted-foreground">{relativeTime(d.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminCard>
        )}
        {finance && (
          <AdminCard title="Withdrawal queue" actions={<Link href="/admin/finance/withdrawals" className="text-xs font-medium text-primary">View all</Link>} bodyClassName="p-0">
            <ul className="divide-y text-sm">
              {queue.length === 0 && <li className="p-4 text-muted-foreground">Queue is clear</li>}
              {queue.map((w) => (
                <li key={w.id}>
                  <Link href={`/admin/finance/withdrawals/${w.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40">
                    <span className="min-w-0">
                      <span className="block truncate">{w.name}</span>
                      <StatusBadge status={w.status} />
                    </span>
                    <span className="text-right">
                      <span className="block font-medium tabular">{formatCash(w.amount, { currency: fiat })}</span>
                      <span className="block text-xs text-muted-foreground">{relativeTime(w.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminCard>
        )}
        {ctx.can("risk.view") && (
          <AdminCard title="Recent risk signals" actions={<Link href="/admin/risk/flags" className="text-xs font-medium text-primary">View all</Link>} bodyClassName="p-0">
            <ul className="divide-y text-sm">
              {flags.length === 0 && <li className="p-4 text-muted-foreground">No open signals</li>}
              {flags.map((f) => (
                <li key={f.id}>
                  <Link href={`/admin/risk/flags/${f.id}`} className="flex items-start justify-between gap-2 px-4 py-2.5 hover:bg-muted/40">
                    <span className="line-clamp-2">{f.summary}</span>
                    <StatusBadge status={f.severity} tone={f.severity === "HIGH" ? "danger" : f.severity === "MEDIUM" ? "warning" : "neutral"} />
                  </Link>
                </li>
              ))}
            </ul>
          </AdminCard>
        )}
      </div>
    </AdminPage>
  );
}
