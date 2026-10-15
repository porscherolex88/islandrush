import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BulkTicketBar } from "@/components/admin/support-controls";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, StatGrid, StatsCard, UserLink, pageOf, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { relativeTime } from "@/lib/time";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Support tickets" };
const PAGE = 50;
const STATUSES = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export default async function SupportPage({ searchParams }: PageProps<"/admin/support">) {
  const admin = await requireAdmin("support.view");
  const canManage = admin.can("support.manage");
  const sp = await searchParams;
  const page = pageOf(sp);
  const status = str(sp.status);
  const priority = str(sp.priority);
  const assigned = str(sp.assigned);
  const tag = str(sp.tag)?.trim();
  const q = str(sp.q)?.trim();
  const like = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const num = q && /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
  const [list, stats] = await Promise.all([
    rows<{ id: string; number: number; subject: string; category: string; status: string; priority: string; tags: string[]; last_message_at: string; created_at: string; user_id: string | null; name: string | null; email: string | null; contact_phone: string | null; contact_name: string | null; assignee: string | null; awaiting: boolean; messages: number }>(sql`
      select t.id, t.number, t.subject, t.category, t.status::text, t.priority::text, t.tags, t.last_message_at::text, t.created_at::text,
        p.id as user_id, p.name, p.email, t.contact_phone, t.contact_name, a.name as assignee,
        coalesce((select not m.from_staff from support_messages m where m.ticket_id = t.id and not m.is_internal order by m.created_at desc limit 1), true) as awaiting,
        (select count(*)::int from support_messages m where m.ticket_id = t.id and not m.is_internal) as messages
      from support_tickets t left join profiles p on p.id = t.user_id left join profiles a on a.id = t.assigned_to_id
      where true
        ${status && STATUSES.includes(status as never) ? sql`and t.status = ${status}::ticket_status` : !status ? sql`and t.status in ('OPEN', 'PENDING')` : sql``}
        ${priority && PRIORITIES.includes(priority as never) ? sql`and t.priority = ${priority}::ticket_priority` : sql``}
        ${assigned === "me" ? sql`and t.assigned_to_id = ${admin.user.id}` : assigned === "none" ? sql`and t.assigned_to_id is null` : sql``}
        ${tag ? sql`and t.tags ? ${tag}` : sql``}
        ${num !== null ? sql`and t.number = ${num}` : like ? sql`and (t.subject ilike ${like} or coalesce(p.email, '') ilike ${like} or coalesce(p.name, '') ilike ${like} or coalesce(t.contact_phone, '') ilike ${like} or coalesce(t.contact_name, '') ilike ${like})` : sql``}
      order by case t.priority when 'URGENT' then 0 when 'HIGH' then 1 when 'NORMAL' then 2 else 3 end, t.last_message_at
      limit ${PAGE + 1} offset ${(page - 1) * PAGE}`),
    one<{ open: number; pending: number; unassigned: number; mine: number; urgent: number }>(sql`
      select count(*) filter (where status = 'OPEN')::int as open, count(*) filter (where status = 'PENDING')::int as pending,
        count(*) filter (where status in ('OPEN', 'PENDING') and assigned_to_id is null)::int as unassigned,
        count(*) filter (where status in ('OPEN', 'PENDING') and assigned_to_id = ${admin.user.id})::int as mine,
        count(*) filter (where status in ('OPEN', 'PENDING') and priority in ('HIGH', 'URGENT'))::int as urgent
      from support_tickets`),
  ]);
  const shown = list.slice(0, PAGE);

  return (
    <AdminPage title="Support tickets" description="Open and pending tickets by default, most urgent and longest waiting first.">
      <StatGrid cols={5}>
        <StatsCard label="Open" value={stats.open} tone={stats.open ? "warning" : "default"} href="/admin/support?status=OPEN" />
        <StatsCard label="Pending" value={stats.pending} href="/admin/support?status=PENDING" />
        <StatsCard label="Unassigned" value={stats.unassigned} href="/admin/support?assigned=none" />
        <StatsCard label="Assigned to me" value={stats.mine} href="/admin/support?assigned=me" />
        <StatsCard label="High priority" value={stats.urgent} tone={stats.urgent ? "danger" : "default"} />
      </StatGrid>
      <FilterBar basePath="/admin/support">
        <FilterSelect name="status" label="Status" value={status} options={STATUSES} allLabel="Open and pending" />
        <FilterSelect name="priority" label="Priority" value={priority} options={PRIORITIES} />
        <FilterSelect name="assigned" label="Assigned" value={assigned} options={[{ value: "me", label: "Me" }, { value: "none", label: "Unassigned" }]} allLabel="Anyone" />
        <FilterInput name="tag" label="Tag" value={tag} className="w-32" />
        <FilterInput name="q" label="Search" value={q} placeholder="#number, subject, user" />
      </FilterBar>
      {canManage && shown.length > 0 && <BulkTicketBar />}
      <DataTable
        rows={shown}
        rowKey={(t) => t.id}
        selectable={canManage ? "tickets" : undefined}
        empty="No tickets match"
        columns={[
          { key: "n", header: "#", cell: (t) => <Link href={`/admin/support/${t.id}`} className="font-mono text-xs text-primary hover:underline">#{t.number}</Link> },
          {
            key: "s",
            header: "Subject",
            cell: (t) => (
              <div className="max-w-sm">
                <Link href={`/admin/support/${t.id}`} className="font-medium hover:underline">
                  {t.subject}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t.category.toLowerCase()} · {t.messages} messages{t.tags.length ? ` · ${t.tags.join(", ")}` : ""}
                </p>
              </div>
            ),
          },
          {
            key: "u",
            header: "User",
            cell: (t) =>
              t.user_id && t.name ? (
                <UserLink id={t.user_id} name={t.name} email={t.email ?? t.contact_phone ?? ""} />
              ) : (
                <span className="text-xs">
                  <span className="font-medium">Guest</span>
                  <span className="mt-0.5 block text-muted-foreground">{t.contact_phone ?? t.contact_name ?? "Password reset"}</span>
                </span>
              ),
          },
          { key: "p", header: "Priority", cell: (t) => <StatusBadge status={t.priority} /> },
          { key: "st", header: "Status", cell: (t) => <div className="flex flex-col items-start gap-1"><StatusBadge status={t.status} />{t.awaiting && (t.status === "OPEN" || t.status === "PENDING") && <span className="text-[10px] font-medium text-amber-600">Awaiting staff</span>}</div> },
          { key: "a", header: "Assignee", cell: (t) => <span className="text-xs text-muted-foreground">{t.assignee ?? "-"}</span> },
          { key: "l", header: "Last message", cell: (t) => <span className="whitespace-nowrap text-xs">{relativeTime(new Date(t.last_message_at))}</span> },
        ]}
      />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/support" />
    </AdminPage>
  );
}
