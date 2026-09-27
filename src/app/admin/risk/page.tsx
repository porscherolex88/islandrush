import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard, HBarList } from "@/components/admin/charts";
import { AdminCard, AdminPage, DataTable, StatGrid, StatsCard, UserLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { formatMYR } from "@/lib/money";
import { relativeTime } from "@/lib/time";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Risk dashboard" };

export default async function RiskDashboard() {
  await requireAdmin("risk.view");
  const [summary, byType, urgent, holds] = await Promise.all([
    one<{ open: number; review: number; high: number; week: number; failed: number; shared_ip: number; shared_device: number; suspended: number }>(sql`
      select
        (select count(*)::int from risk_flags where status = 'OPEN') as open,
        (select count(*)::int from risk_flags where status = 'IN_REVIEW') as review,
        (select count(*)::int from risk_flags where status in ('OPEN', 'IN_REVIEW') and severity = 'HIGH') as high,
        (select count(*)::int from risk_flags where created_at > now() - interval '7 days') as week,
        (select count(*)::int from login_events where not success and created_at > now() - interval '24 hours') as failed,
        (select count(*)::int from (select ip from login_events where ip is not null and user_id is not null group by ip having count(distinct user_id) > 1) x) as shared_ip,
        (select count(*)::int from (select device_id from login_events where device_id is not null and user_id is not null group by device_id having count(distinct user_id) > 1) x) as shared_device,
        (select count(*)::int from profiles where status = 'SUSPENDED') as suspended`),
    rows<{ type: string; n: number }>(sql`select type::text, count(*)::int as n from risk_flags where status in ('OPEN', 'IN_REVIEW') group by 1 order by 2 desc`),
    rows<{ id: string; type: string; severity: string; status: string; summary: string; created_at: string; user_id: string; name: string; email: string }>(sql`
      select f.id, f.type::text, f.severity::text, f.status::text, f.summary, f.created_at::text, p.id as user_id, p.name, p.email
      from risk_flags f join profiles p on p.id = f.user_id
      where f.status in ('OPEN', 'IN_REVIEW')
      order by case f.severity when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end, f.created_at
      limit 10`),
    one<{ held: string; held_n: number; on_hold: number }>(sql`
      select coalesce(sum(amount) filter (where status = 'HELD'), 0)::text as held, count(*) filter (where status = 'HELD')::int as held_n,
        (select count(*)::int from profiles where rewards_on_hold) as on_hold
      from cash_rewards`),
  ]);

  return (
    <AdminPage title="Risk dashboard" description="Signals are recorded automatically. Flags never block players on their own: review them and act from the flag or user page.">
      <StatGrid cols={4}>
        <StatsCard label="Open flags" value={summary.open} tone={summary.open ? "warning" : "default"} href="/admin/risk/flags?status=OPEN" />
        <StatsCard label="In review" value={summary.review} href="/admin/risk/flags?status=IN_REVIEW" />
        <StatsCard label="High severity (active)" value={summary.high} tone={summary.high ? "danger" : "default"} href="/admin/risk/flags?severity=HIGH" />
        <StatsCard label="New flags (7 days)" value={summary.week} />
        <StatsCard label="Failed logins (24h)" value={summary.failed} href="/admin/risk/logins?success=false" />
        <StatsCard label="Shared IPs / devices" value={`${summary.shared_ip} / ${summary.shared_device}`} href="/admin/risk/signals" />
        <StatsCard label="Held rewards" value={formatMYR(holds.held)} hint={`${holds.held_n} rewards · ${holds.on_hold} accounts on hold`} href="/admin/referrals/rewards?status=HELD" />
        <StatsCard label="Suspended accounts" value={summary.suspended} href="/admin/users?status=SUSPENDED" />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <AdminCard title="Needs attention" bodyClassName="p-0" actions={<Link href="/admin/risk/flags" className="text-sm text-primary hover:underline">All flags</Link>}>
          <DataTable
            rows={urgent}
            rowKey={(f) => f.id}
            empty="No active flags"
            columns={[
              { key: "s", header: "Flag", cell: (f) => <Link href={`/admin/risk/flags/${f.id}`} className="font-medium text-primary hover:underline">{f.summary}</Link> },
              { key: "u", header: "User", cell: (f) => <UserLink id={f.user_id} name={f.name} email={f.email} /> },
              { key: "sev", header: "Severity", cell: (f) => <StatusBadge status={f.severity} /> },
              { key: "a", header: "Age", cell: (f) => <span className="whitespace-nowrap text-xs">{relativeTime(new Date(f.created_at))}</span> },
            ]}
          />
        </AdminCard>
        <ChartCard title="Active flags by type">
          <HBarList data={byType.map((t) => ({ label: t.type.replace(/_/g, " ").toLowerCase(), value: t.n }))} />
        </ChartCard>
      </div>
    </AdminPage>
  );
}
