import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/actions";
import { AdminPage, DataTable, FilterBar, FilterSelect, UserLink, str } from "@/components/admin/ui";
import { getAuthSession, requireAdmin } from "@/lib/auth/session";
import { formatDateTime, relativeTime } from "@/lib/time";
import { revokeSessionAction } from "@/server/actions/admin/ops";
import { rows } from "@/server/admin/queries";
import { humanize } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Sessions" };

export default async function SessionsPage({ searchParams }: PageProps<"/admin/admins/sessions">) {
  await requireAdmin("admins.manage");
  const sp = await searchParams;
  const scope = str(sp.scope) ?? "staff";
  const user = str(sp.user);
  const current = await getAuthSession().catch(() => null);
  const list = await rows<{ id: string; created_at: string; updated_at: string; expires_at: string; ip: string | null; user_agent: string | null; user_id: string; name: string; email: string; role: string }>(sql`
    select s.id::text, s."createdAt"::text as created_at, s."updatedAt"::text as updated_at, s."expiresAt"::text as expires_at, s."ipAddress" as ip, s."userAgent" as user_agent,
      p.id as user_id, p.name, p.email, p.role::text
    from neon_auth.session s join profiles p on p.id = s."userId"::text
    where s."expiresAt" > now()
      ${user ? sql`and p.id = ${user}` : scope === "staff" ? sql`and p.role <> 'USER'` : sql``}
    order by s."updatedAt" desc limit 200`);
  return (
    <AdminPage title="Active sessions" description="Signed-in devices. Revoking a session signs that device out on its next request.">
      <FilterBar basePath="/admin/admins/sessions">
        <FilterSelect name="scope" label="Accounts" value={scope} options={[{ value: "staff", label: "Staff only" }, { value: "all", label: "All accounts" }]} allLabel="Staff only" />
      </FilterBar>
      <DataTable
        rows={list}
        rowKey={(s) => s.id}
        empty="No active sessions"
        columns={[
          { key: "u", header: "Account", cell: (s) => <UserLink id={s.user_id} name={s.name} email={s.email} /> },
          { key: "r", header: "Role", cell: (s) => <span className="text-xs">{humanize(s.role)}</span> },
          { key: "c", header: "Signed in", cell: (s) => <span className="whitespace-nowrap text-xs">{formatDateTime(s.created_at)}</span> },
          { key: "a", header: "Last active", cell: (s) => <span className="whitespace-nowrap text-xs">{relativeTime(new Date(s.updated_at))}</span> },
          { key: "ip", header: "IP", cell: (s) => <code className="text-xs">{s.ip ?? "-"}</code> },
          { key: "ua", header: "Device", cell: (s) => <span className="line-clamp-1 max-w-56 text-xs text-muted-foreground">{s.user_agent ?? "-"}</span> },
          {
            key: "x",
            header: "",
            cell: (s) =>
              current?.session.id === s.id ? (
                <span className="text-xs text-muted-foreground">This device</span>
              ) : (
                <ActionButton action={revokeSessionAction} args={[s.id]} variant="outline" success="Session revoked" confirm={{ title: "Revoke this session?", description: `${s.name} will be signed out on that device.`, reasonLabel: "Reason", destructive: true, confirmLabel: "Revoke" }}>
                  Revoke
                </ActionButton>
              ),
          },
        ]}
      />
    </AdminPage>
  );
}
