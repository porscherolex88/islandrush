import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/actions";
import { AdminCard, AdminPage, DataTable, FilterBar, FilterSelect, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { jobRuns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime, relativeTime } from "@/lib/time";
import { runJobAction } from "@/server/actions/admin/ops";
import { rows } from "@/server/admin/queries";
import { JOBS, type JobName } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Jobs" };

const SCHEDULES: Record<JobName, string> = {
  "settle-rewards": "Daily, plus on demand when players open their wallet",
  "send-broadcasts": "Daily, or send immediately from the broadcast",
  reconcile: "Daily",
  "cleanup-rate-limits": "Daily",
  "poll-usdt-deposits": "Every 5 minutes (Vercel Cron)",
};

export default async function JobsPage({ searchParams }: PageProps<"/admin/system/jobs">) {
  await requireAdmin("system.manage");
  const sp = await searchParams;
  const job = str(sp.job);
  const [last, history] = await Promise.all([
    rows<{ job: string; status: string; started_at: string; finished_at: string | null; error: string | null }>(sql`
      select distinct on (job) job, status::text, started_at::text, finished_at::text, error from job_runs order by job, started_at desc`),
    db
      .select()
      .from(jobRuns)
      .where(job && job in JOBS ? eq(jobRuns.job, job) : undefined)
      .orderBy(desc(jobRuns.startedAt))
      .limit(50),
  ]);
  const names = Object.keys(JOBS) as JobName[];

  return (
    <AdminPage title="Jobs and tasks" description="Background jobs run on Vercel Cron. Run any job now if you need it sooner; runs are idempotent.">
      <AdminCard bodyClassName="p-0">
        <DataTable
          rows={names}
          rowKey={(n) => n}
          columns={[
            {
              key: "j",
              header: "Job",
              cell: (n) => (
                <div>
                  <p className="font-medium">{JOBS[n].label}</p>
                  <p className="text-xs text-muted-foreground">{JOBS[n].description}</p>
                </div>
              ),
            },
            { key: "s", header: "Schedule", cell: (n) => <span className="text-xs">{SCHEDULES[n]}</span> },
            {
              key: "l",
              header: "Last run",
              cell: (n) => {
                const r = last.find((x) => x.job === n);
                return r ? (
                  <div className="flex flex-col items-start gap-0.5">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">{relativeTime(new Date(r.started_at))}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Never</span>
                );
              },
            },
            {
              key: "x",
              header: "",
              cell: (n) => (
                <div className="flex justify-end">
                  <ActionButton action={runJobAction} args={[n]} variant="outline" success={`${JOBS[n].label} finished`}>
                    Run now
                  </ActionButton>
                </div>
              ),
            },
          ]}
        />
      </AdminCard>
      <FilterBar basePath="/admin/system/jobs">
        <FilterSelect name="job" label="Job" value={job} options={names.map((n) => ({ value: n, label: JOBS[n].label }))} />
      </FilterBar>
      <AdminCard title="Run history" bodyClassName="p-0">
        <DataTable
          rows={history}
          rowKey={(r) => r.id}
          empty="No runs yet"
          columns={[
            { key: "t", header: "Started", cell: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.startedAt)}</span> },
            { key: "j", header: "Job", cell: (r) => JOBS[r.job as JobName]?.label ?? r.job },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "d", header: "Duration", align: "right", cell: (r) => (r.finishedAt ? `${((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000).toFixed(1)}s` : "-") },
            { key: "b", header: "Triggered by", cell: (r) => <span className="text-xs">{r.triggeredBy === "cron" ? "Cron" : r.triggeredBy ? "Admin" : "-"}</span> },
            { key: "r", header: "Result", cell: (r) => <code className="line-clamp-2 max-w-md text-xs">{r.error ?? JSON.stringify(r.result)}</code> },
          ]}
        />
      </AdminCard>
    </AdminPage>
  );
}
