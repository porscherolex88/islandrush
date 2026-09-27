import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, DataTable } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Device and IP signals" };

type Shared = { value: string; users: number; names: string[]; ids: string[]; last: string };

function SharedTable({ data, kind }: { data: Shared[]; kind: "ip" | "device" | "account" }) {
  return (
    <DataTable
      rows={data}
      rowKey={(r) => r.value}
      empty="Nothing shared across accounts"
      columns={[
        {
          key: "v",
          header: kind === "ip" ? "IP address" : kind === "device" ? "Device ID" : "Account number",
          cell: (r) =>
            kind === "account" ? (
              <code className="text-xs">{r.value}</code>
            ) : (
              <Link href={`/admin/risk/logins?${kind}=${encodeURIComponent(r.value)}`} className="font-mono text-xs text-primary hover:underline">
                {kind === "device" ? r.value.slice(0, 16) : r.value}
              </Link>
            ),
        },
        { key: "n", header: "Accounts", align: "right", cell: (r) => <span className={r.users >= 3 ? "font-semibold text-red-600" : "font-semibold text-amber-600"}>{r.users}</span> },
        {
          key: "u",
          header: "Users",
          cell: (r) => (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
              {r.ids.slice(0, 6).map((id, i) => (
                <Link key={id} href={`/admin/users/${id}?tab=risk`} className="text-primary hover:underline">
                  {r.names[i]}
                </Link>
              ))}
              {r.ids.length > 6 && <span className="text-muted-foreground">+{r.ids.length - 6} more</span>}
            </div>
          ),
        },
        { key: "l", header: "Last seen", cell: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.last)}</span> },
      ]}
    />
  );
}

export default async function SignalsPage() {
  await requireAdmin("risk.view");
  const [ips, devices, accounts] = await Promise.all([
    rows<Shared>(sql`
      select x.ip as value, count(distinct x.user_id)::int as users, array_agg(distinct p.name) as names, array_agg(distinct p.id) as ids, max(x.at)::text as last
      from (
        select ip, user_id, created_at as at from login_events where ip is not null and user_id is not null
        union all select signup_ip, id, created_at from profiles where signup_ip is not null
      ) x join profiles p on p.id = x.user_id
      group by x.ip having count(distinct x.user_id) > 1 order by users desc, last desc limit 50`),
    rows<Shared>(sql`
      select x.device_id as value, count(distinct x.user_id)::int as users, array_agg(distinct p.name) as names, array_agg(distinct p.id) as ids, max(x.at)::text as last
      from (
        select device_id, user_id, created_at as at from login_events where device_id is not null and user_id is not null
        union all select signup_device_id, id, created_at from profiles where signup_device_id is not null
      ) x join profiles p on p.id = x.user_id
      group by x.device_id having count(distinct x.user_id) > 1 order by users desc, last desc limit 50`),
    rows<Shared>(sql`
      select regexp_replace(w.account_number, '.(?=.{4})', '•', 'g') as value, count(distinct w.user_id)::int as users,
        array_agg(distinct p.name) as names, array_agg(distinct p.id) as ids, max(w.created_at)::text as last
      from withdrawal_accounts w join profiles p on p.id = w.user_id
      group by w.account_number having count(distinct w.user_id) > 1 order by users desc limit 50`),
  ]);
  return (
    <AdminPage title="Device and IP signals" description="Identifiers used by more than one account. Shared signals can be innocent (families, offices, mobile carriers), so review before acting.">
      <AdminCard title="Shared IP addresses" bodyClassName="p-0">
        <SharedTable data={ips} kind="ip" />
      </AdminCard>
      <AdminCard title="Shared devices" bodyClassName="p-0">
        <SharedTable data={devices} kind="device" />
      </AdminCard>
      <AdminCard title="Shared withdrawal accounts" bodyClassName="p-0">
        <SharedTable data={accounts} kind="account" />
      </AdminCard>
    </AdminPage>
  );
}
