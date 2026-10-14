import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, UserLink, pageOf, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Login activity" };
const PAGE = 100;

export default async function LoginsPage({ searchParams }: PageProps<"/admin/risk/logins">) {
  await requireAdmin("risk.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const success = str(sp.success);
  const q = str(sp.q)?.trim();
  const ip = str(sp.ip)?.trim();
  const device = str(sp.device)?.trim();
  const from = str(sp.from);
  const like = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const list = await rows<{ id: string; created_at: string; success: boolean; email: string | null; ip: string | null; device_id: string | null; user_agent: string | null; user_id: string | null; name: string | null; ip_users: number }>(sql`
    select l.id, l.created_at::text, l.success, l.email, l.ip, l.device_id, l.user_agent, p.id as user_id, p.name,
      (select count(distinct x.user_id)::int from login_events x where x.ip = l.ip and x.user_id is not null) as ip_users
    from login_events l left join profiles p on p.id = l.user_id
    where true
      ${success === "true" ? sql`and l.success` : success === "false" ? sql`and not l.success` : sql``}
      ${like ? sql`and (l.email ilike ${like} or p.name ilike ${like})` : sql``}
      ${ip ? sql`and l.ip = ${ip}` : sql``}
      ${device ? sql`and l.device_id = ${device}` : sql``}
      ${from ? sql`and l.created_at >= ${new Date(`${from}T00:00:00+08:00`)}` : sql``}
    order by l.created_at desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`);
  const shown = list.slice(0, PAGE);

  return (
    <AdminPage title="Login activity" description="Every sign-in attempt, successful or not. Click an IP or device to see everyone who used it.">
      <FilterBar basePath="/admin/risk/logins">
        <FilterSelect name="success" label="Result" value={success} options={[{ value: "true", label: "Successful" }, { value: "false", label: "Failed" }]} />
        <FilterInput name="q" label="User" value={q} placeholder="Email or name" />
        <FilterInput name="ip" label="IP" value={ip} />
        <FilterInput name="device" label="Device ID" value={device} />
        <FilterInput name="from" label="Since" type="date" value={from} />
      </FilterBar>
      <DataTable
        rows={shown}
        rowKey={(l) => l.id}
        empty="No login events match"
        columns={[
          { key: "t", header: "Time", cell: (l) => <span className="whitespace-nowrap">{formatDateTime(l.created_at)}</span> },
          { key: "r", header: "Result", cell: (l) => <StatusBadge status={l.success ? "SUCCESS" : "FAILED"} /> },
          { key: "u", header: "User", cell: (l) => (l.user_id ? <UserLink id={l.user_id} name={l.name} email={l.email} /> : <span className="text-xs">{l.email ?? "Unknown"}</span>) },
          {
            key: "ip",
            header: "IP",
            cell: (l) =>
              l.ip ? (
                <Link href={`/admin/risk/logins?ip=${encodeURIComponent(l.ip)}`} className="font-mono text-xs hover:underline">
                  {l.ip}
                  {l.ip_users > 1 && <span className="ml-1 text-amber-600">({l.ip_users} users)</span>}
                </Link>
              ) : (
                "-"
              ),
          },
          { key: "d", header: "Device", cell: (l) => (l.device_id ? <Link href={`/admin/risk/logins?device=${encodeURIComponent(l.device_id)}`} className="font-mono text-xs hover:underline">{l.device_id.slice(0, 12)}</Link> : "-") },
          { key: "ua", header: "User agent", cell: (l) => <span className="line-clamp-1 max-w-64 text-xs text-muted-foreground">{l.user_agent ?? "-"}</span> },
        ]}
      />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/risk/logins" />
    </AdminPage>
  );
}
