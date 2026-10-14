import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, UserLink, pageOf, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Risk flags" };
const PAGE = 50;
const STATUSES = ["OPEN", "IN_REVIEW", "CLEARED", "CONFIRMED"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const TYPES = ["SELF_REFERRAL", "DUPLICATE_ACCOUNT", "PAYMENT_METHOD_MATCH", "DEVICE_MATCH", "IP_MATCH", "RAPID_SIGNUP", "REFERRAL_VELOCITY", "SUSPICIOUS_DEPOSIT", "UNUSUAL_REWARD", "UNUSUAL_WITHDRAWAL", "MANUAL"] as const;
const REFERRAL_TYPES = ["SELF_REFERRAL", "REFERRAL_VELOCITY", "DUPLICATE_ACCOUNT", "DEVICE_MATCH", "IP_MATCH", "PAYMENT_METHOD_MATCH"];

export default async function RiskFlagsPage({ searchParams }: PageProps<"/admin/risk/flags">) {
  const admin = await requireAdmin("risk.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const status = str(sp.status);
  const severity = str(sp.severity);
  const type = str(sp.type);
  const group = str(sp.group);
  const assigned = str(sp.assigned);
  const q = str(sp.q)?.trim();
  const like = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const where = sql`true
    ${status && STATUSES.includes(status as never) ? sql`and f.status = ${status}::risk_status` : !status ? sql`and f.status in ('OPEN', 'IN_REVIEW')` : sql``}
    ${severity && SEVERITIES.includes(severity as never) ? sql`and f.severity = ${severity}::risk_severity` : sql``}
    ${type && TYPES.includes(type as never) ? sql`and f.type = ${type}::risk_type` : sql``}
    ${group === "referral" ? sql`and (f.type::text in (${sql.join(REFERRAL_TYPES.map((t) => sql`${t}`), sql`, `)}) or f.related_user_id is not null)` : sql``}
    ${assigned === "me" ? sql`and f.assigned_to_id = ${admin.user.id}` : assigned === "none" ? sql`and f.assigned_to_id is null` : sql``}
    ${like ? sql`and (p.email ilike ${like} or p.name ilike ${like} or f.summary ilike ${like})` : sql``}`;
  const list = await rows<{
    id: string;
    type: string;
    severity: string;
    status: string;
    summary: string;
    created_at: string;
    user_id: string;
    name: string;
    email: string;
    related_id: string | null;
    related_name: string | null;
    related_email: string | null;
    assignee: string | null;
  }>(sql`
    select f.id, f.type::text, f.severity::text, f.status::text, f.summary, f.created_at::text,
      p.id as user_id, p.name, p.email, r.id as related_id, r.name as related_name, r.email as related_email, a.name as assignee
    from risk_flags f join profiles p on p.id = f.user_id
    left join profiles r on r.id = f.related_user_id
    left join profiles a on a.id = f.assigned_to_id
    where ${where}
    order by case f.severity when 'HIGH' then 0 when 'MEDIUM' then 1 else 2 end, f.created_at desc
    limit ${PAGE + 1} offset ${(page - 1) * PAGE}`);
  const shown = list.slice(0, PAGE);

  return (
    <AdminPage title={group === "referral" ? "Referral risk" : "Flagged accounts"} description="Active flags by default. Choose a status to see resolved flags.">
      <FilterBar basePath="/admin/risk/flags" keep={["group"]} sp={sp}>
        <FilterSelect name="status" label="Status" value={status} options={STATUSES} allLabel="Active (default)" />
        <FilterSelect name="severity" label="Severity" value={severity} options={SEVERITIES} />
        <FilterSelect name="type" label="Type" value={type} options={TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ").toLowerCase() }))} />
        <FilterSelect name="assigned" label="Assigned" value={assigned} options={[{ value: "me", label: "Assigned to me" }, { value: "none", label: "Unassigned" }]} allLabel="Anyone" />
        <FilterInput name="q" label="Search" value={q} placeholder="User or summary" />
      </FilterBar>
      <DataTable
        rows={shown}
        rowKey={(f) => f.id}
        empty="No flags match"
        columns={[
          { key: "t", header: "Raised", cell: (f) => <Link href={`/admin/risk/flags/${f.id}`} className="whitespace-nowrap text-primary hover:underline">{formatDateTime(f.created_at)}</Link> },
          { key: "s", header: "Summary", cell: (f) => <Link href={`/admin/risk/flags/${f.id}`} className="font-medium hover:underline">{f.summary}</Link> },
          { key: "ty", header: "Type", cell: (f) => <span className="text-xs">{f.type.replace(/_/g, " ").toLowerCase()}</span> },
          { key: "u", header: "User", cell: (f) => <UserLink id={f.user_id} name={f.name} email={f.email} /> },
          { key: "r", header: "Related", cell: (f) => (f.related_id ? <UserLink id={f.related_id} name={f.related_name} email={f.related_email} /> : "-") },
          { key: "sev", header: "Severity", cell: (f) => <StatusBadge status={f.severity} /> },
          { key: "st", header: "Status", cell: (f) => <StatusBadge status={f.status} /> },
          { key: "a", header: "Assignee", cell: (f) => <span className="text-xs text-muted-foreground">{f.assignee ?? "-"}</span> },
        ]}
      />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/risk/flags" />
    </AdminPage>
  );
}
