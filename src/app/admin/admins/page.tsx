import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { GrantAdminForm, RoleSelect } from "@/components/admin/admin-management";
import { AdminCard, AdminPage, DataTable, UserLink } from "@/components/admin/ui";
import { StatusBadge , humanize } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { ADMIN_ROLES } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin users" };

export default async function AdminsPage() {
  const admin = await requireAdmin("admins.manage");
  const list = await rows<{ id: string; name: string; email: string; role: string; status: string; last_login: string | null; actions_30d: number; sessions: number }>(sql`
    select p.id, p.name, p.email, p.role::text, p.status::text,
      (select max(created_at)::text from login_events l where l.user_id = p.id and l.success) as last_login,
      (select count(*)::int from audit_logs a where a.actor_id = p.id and a.created_at > now() - interval '30 days') as actions_30d,
      (select count(*)::int from neon_auth.session s where s."userId"::text = p.id and s."expiresAt" > now()) as sessions
    from profiles p where p.role <> 'USER'
    order by case p.role when 'SUPER_ADMIN' then 0 when 'FINANCE' then 1 when 'GAME_ADMIN' then 2 else 3 end, p.name`);
  const assignable = admin.role === "SUPER_ADMIN" ? [...ADMIN_ROLES, "USER"] : ADMIN_ROLES.filter((r) => r !== "SUPER_ADMIN").concat("USER");
  const grantable = assignable.filter((r) => r !== "USER");

  return (
    <AdminPage title="Admin users" description="Staff accounts and their roles. Role changes need a reason, recent sign-in, and are audited.">
      <AdminCard title="Staff" bodyClassName="p-0">
        <DataTable
          rows={list}
          rowKey={(a) => a.id}
          columns={[
            { key: "u", header: "Admin", cell: (a) => <UserLink id={a.id} name={a.name} email={a.email} /> },
            {
              key: "r",
              header: "Role",
              cell: (a) =>
                a.id === admin.user.id || (a.role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") ? (
                  <span className="text-sm font-medium">{humanize(a.role)}{a.id === admin.user.id ? " (you)" : ""}</span>
                ) : (
                  <RoleSelect userId={a.id} role={a.role} roles={assignable} />
                ),
            },
            { key: "s", header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
            { key: "l", header: "Last sign-in", cell: (a) => <span className="text-xs">{a.last_login ? formatDateTime(a.last_login) : "Never"}</span> },
            { key: "se", header: "Active sessions", align: "right", cell: (a) => <Link href={`/admin/admins/sessions?user=${a.id}`} className="text-primary hover:underline">{a.sessions}</Link> },
            { key: "a", header: "Actions (30d)", align: "right", cell: (a) => <Link href={`/admin/audit?actor=${a.id}`} className="text-primary hover:underline">{a.actions_30d}</Link> },
          ]}
        />
      </AdminCard>
      <AdminCard title="Grant admin access" description="Promote an existing account. Ask the person to register first if they do not have one.">
        <GrantAdminForm roles={grantable} />
      </AdminCard>
    </AdminPage>
  );
}
