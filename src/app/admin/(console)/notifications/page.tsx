import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, StatGrid, StatsCard, UserLink, pageOf, str } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "In-app notifications" };
const PAGE = 100;
const TYPES = ["REWARD", "MISSION", "COLLECTION", "REFERRAL", "WALLET", "SYSTEM"] as const;

export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  await requireAdmin("notifications.manage");
  const sp = await searchParams;
  const page = pageOf(sp);
  const type = str(sp.type);
  const read = str(sp.read);
  const q = str(sp.q)?.trim();
  const like = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const [list, stats] = await Promise.all([
    rows<{ id: string; type: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string; broadcast_id: string | null; user_id: string; name: string; email: string }>(sql`
      select n.id, n.type::text, n.title, n.body, n.link, n.read_at::text, n.created_at::text, n.broadcast_id, p.id as user_id, p.name, p.email
      from notifications n join profiles p on p.id = n.user_id
      where true
        ${type && TYPES.includes(type as never) ? sql`and n.type = ${type}::notification_type` : sql``}
        ${read === "unread" ? sql`and n.read_at is null` : read === "read" ? sql`and n.read_at is not null` : sql``}
        ${like ? sql`and (p.email ilike ${like} or p.name ilike ${like} or n.title ilike ${like})` : sql``}
      order by n.created_at desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`),
    one<{ day: number; week: number; unread: number; read_rate: number }>(sql`
      select count(*) filter (where created_at > now() - interval '24 hours')::int as day,
        count(*) filter (where created_at > now() - interval '7 days')::int as week,
        count(*) filter (where read_at is null)::int as unread,
        coalesce(round(100.0 * count(*) filter (where read_at is not null and created_at > now() - interval '30 days') / nullif(count(*) filter (where created_at > now() - interval '30 days'), 0), 1), 0)::float as read_rate
      from notifications`),
  ]);
  const shown = list.slice(0, PAGE);
  return (
    <AdminPage
      title="In-app notifications"
      description="Everything delivered to players' notification centers. Send to one player from their profile, or to many with a broadcast."
      actions={
        <Button asChild>
          <Link href="/admin/manage/broadcasts/new">New broadcast</Link>
        </Button>
      }
    >
      <StatGrid cols={4}>
        <StatsCard label="Sent (24h)" value={stats.day.toLocaleString()} />
        <StatsCard label="Sent (7 days)" value={stats.week.toLocaleString()} />
        <StatsCard label="Unread" value={stats.unread.toLocaleString()} />
        <StatsCard label="Read rate (30 days)" value={`${stats.read_rate}%`} />
      </StatGrid>
      <FilterBar basePath="/admin/notifications">
        <FilterSelect name="type" label="Type" value={type} options={TYPES} />
        <FilterSelect name="read" label="Read" value={read} options={[{ value: "unread", label: "Unread" }, { value: "read", label: "Read" }]} />
        <FilterInput name="q" label="Search" value={q} placeholder="User or title" />
      </FilterBar>
      <DataTable
        rows={shown}
        rowKey={(n) => n.id}
        empty="No notifications match"
        columns={[
          { key: "t", header: "Sent", cell: (n) => <span className="whitespace-nowrap">{formatDateTime(n.created_at)}</span> },
          { key: "u", header: "User", cell: (n) => <UserLink id={n.user_id} name={n.name} email={n.email} /> },
          { key: "ty", header: "Type", cell: (n) => <span className="text-xs">{n.type}</span> },
          {
            key: "m",
            header: "Message",
            cell: (n) => (
              <div className="max-w-md">
                <p className="font-medium">{n.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
              </div>
            ),
          },
          { key: "b", header: "Source", cell: (n) => (n.broadcast_id ? <Link href={`/admin/notifications/broadcasts/${n.broadcast_id}`} className="text-xs text-primary hover:underline">Broadcast</Link> : <span className="text-xs text-muted-foreground">System</span>) },
          { key: "r", header: "Read", cell: (n) => (n.read_at ? <span className="text-xs">{formatDateTime(n.read_at)}</span> : <span className="text-xs text-amber-600">Unread</span>) },
        ]}
      />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/notifications" />
    </AdminPage>
  );
}
