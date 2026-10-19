import { sql } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, StatGrid, StatsCard } from "@/components/admin/ui";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { relativeTime } from "@/lib/time";
import { one, rows } from "@/server/admin/queries";
import { runReconciliation } from "@/server/services/admin-finance";
import { getConfig } from "@/server/services/config";
import { JOBS } from "@/server/services/jobs";

export const metadata: Metadata = { title: "System health" };
export const dynamic = "force-dynamic";

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />}
      <div>
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
    </li>
  );
}

async function probeDatabase() {
  const t0 = performance.now();
  await db.execute(sql`select 1`);
  return performance.now() - t0;
}

function olderThanHours(iso: string, hours: number) {
  return Date.now() - Date.parse(iso) > hours * 3_600_000;
}

export default async function HealthPage() {
  await requireAdmin("system.manage");
  const latency = await probeDatabase();
  const [recon, maintenance, jobs, sizes, queues, failures] = await Promise.all([
    runReconciliation(),
    getConfig("maintenance"),
    rows<{ job: string; status: string; started_at: string }>(sql`select distinct on (job) job, status::text, started_at::text from job_runs order by job, started_at desc`),
    one<{ users: number; ledger: number; db_size: string }>(sql`
      select (select count(*)::int from profiles) as users, (select count(*)::int from ledger_entries) as ledger, pg_size_pretty(pg_database_size(current_database())) as db_size`),
    one<{ deposits: number; withdrawals: number; overdue: number; tickets: number }>(sql`
      select (select count(*)::int from deposits where status = 'PENDING') as deposits,
        (select count(*)::int from withdrawals where status in ('PENDING', 'REVIEW', 'APPROVED', 'PROCESSING')) as withdrawals,
        (select count(*)::int from cash_rewards where status = 'PENDING' and settle_after < now() - interval '26 hours') as overdue,
        (select count(*)::int from support_tickets where status = 'OPEN') as tickets`),
    one<{ failed_jobs: number; failed_logins: number }>(sql`
      select (select count(*)::int from job_runs where status = 'FAILED' and started_at > now() - interval '24 hours') as failed_jobs,
        (select count(*)::int from login_events where not success and created_at > now() - interval '1 hour') as failed_logins`),
  ]);
  const staleJobs = (Object.keys(JOBS) as (keyof typeof JOBS)[]).filter((j) => {
    const r = jobs.find((x) => x.job === j);
    return !r || r.status !== "SUCCESS" || olderThanHours(r.started_at, 36);
  });
  const reconOk = recon.every((c) => c.ok);
  const env = {
    cron: Boolean(process.env.CRON_SECRET),
    auth: Boolean(process.env.NEON_AUTH_COOKIE_SECRET ?? process.env.BETTER_AUTH_SECRET),
  };

  return (
    <AdminPage title="System health" description={`Checked ${new Date().toLocaleTimeString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} (Kuala Lumpur).`}>
      <StatGrid cols={4}>
        <StatsCard label="Database latency" value={`${latency.toFixed(0)} ms`} tone={latency > 500 ? "warning" : "success"} />
        <StatsCard label="Reconciliation" value={reconOk ? "Balanced" : `${recon.filter((c) => !c.ok).length} failing`} tone={reconOk ? "success" : "danger"} href="/admin/finance/reconciliation" />
        <StatsCard label="Maintenance mode" value={maintenance.enabled ? "On" : "Off"} tone={maintenance.enabled ? "warning" : "default"} href="/admin/system/settings/maintenance" />
        <StatsCard label="Failed jobs (24h)" value={failures.failed_jobs} tone={failures.failed_jobs ? "danger" : "default"} href="/admin/system/jobs" />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Checks">
          <ul className="divide-y">
            <Check ok={latency < 1000} label="Database reachable" detail={`${latency.toFixed(0)} ms round trip · ${sizes.db_size}`} />
            <Check ok={reconOk} label="Ledger balanced" detail={reconOk ? "All reconciliation checks pass" : recon.filter((c) => !c.ok).map((c) => c.label).join(", ")} />
            <Check ok={staleJobs.length === 0} label="Background jobs current" detail={staleJobs.length ? `Needs attention: ${staleJobs.map((j) => JOBS[j].label).join(", ")}` : "Every job succeeded in the last 36 hours"} />
            <Check ok={queues.overdue === 0} label="Reward settlement on schedule" detail={queues.overdue ? `${queues.overdue} rewards are more than a day past settlement` : "No overdue rewards"} />
            <Check ok={env.cron} label="Cron secret configured" detail="Protects scheduled job endpoints" />
            <Check ok={env.auth} label="Authentication configured" detail="Neon Auth URL and cookie secret" />
            <Check ok={failures.failed_logins < 50} label="Sign-in failures normal" detail={`${failures.failed_logins} failed sign-ins in the last hour`} />
          </ul>
        </AdminCard>
        <div className="space-y-4">
          <AdminCard title="Queues">
            <ul className="divide-y text-sm">
              {[
                ["Pending deposits", queues.deposits, "/admin/finance/deposits"],
                ["Open withdrawals", queues.withdrawals, "/admin/finance/withdrawals"],
                ["Open support tickets", queues.tickets, "/admin/support?status=OPEN"],
              ].map(([l, n, h]) => (
                <li key={String(h)} className="flex justify-between py-2">
                  <Link href={String(h)} className="hover:underline">
                    {l}
                  </Link>
                  <span className="font-semibold tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </AdminCard>
          <AdminCard title="Jobs">
            <ul className="divide-y text-sm">
              {(Object.keys(JOBS) as (keyof typeof JOBS)[]).map((j) => {
                const r = jobs.find((x) => x.job === j);
                return (
                  <li key={j} className="flex justify-between py-2">
                    <span>{JOBS[j].label}</span>
                    <span className={r?.status === "FAILED" ? "text-red-600" : "text-muted-foreground"}>{r ? `${r.status.toLowerCase()} ${relativeTime(new Date(r.started_at))}` : "never run"}</span>
                  </li>
                );
              })}
            </ul>
          </AdminCard>
          <AdminCard title="Data">
            <ul className="divide-y text-sm">
              <li className="flex justify-between py-2">
                <span>Accounts</span>
                <span className="tabular-nums">{sizes.users.toLocaleString()}</span>
              </li>
              <li className="flex justify-between py-2">
                <span>Ledger lines</span>
                <span className="tabular-nums">{sizes.ledger.toLocaleString()}</span>
              </li>
              <li className="flex justify-between py-2">
                <span>Database size</span>
                <span className="tabular-nums">{sizes.db_size}</span>
              </li>
            </ul>
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}
