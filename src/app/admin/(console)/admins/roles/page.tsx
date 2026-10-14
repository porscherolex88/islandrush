import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import { PermissionMatrix } from "@/components/admin/admin-management";
import { AdminCard, AdminPage, StatGrid, StatsCard } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";
import { ALL_PERMISSIONS, PERMISSIONS, type Role } from "@/lib/permissions";
import { rows } from "@/server/admin/queries";
import { permissionsForRole } from "@/server/services/permissions";
import { humanize } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Roles and permissions" };

const EDITABLE: Role[] = ["SUPPORT", "FINANCE", "GAME_ADMIN"];
const SCOPE: Record<string, string> = {
  SUPPORT: "User and support visibility, ticket workflows",
  FINANCE: "Deposits, withdrawals, ledger and reconciliation",
  GAME_ADMIN: "Game, economy, content and progression configuration",
  SUPER_ADMIN: "System, permissions and every administrative function",
};

export default async function RolesPage() {
  await requireAdmin("admins.manage");
  const [granted, counts] = await Promise.all([
    Promise.all(EDITABLE.map(async (r) => [r, [...(await permissionsForRole(r))]] as const)).then(Object.fromEntries),
    rows<{ role: string; n: number }>(sql`select role::text, count(*)::int as n from profiles where role <> 'USER' group by role`),
  ]);
  const n = (r: string) => counts.find((c) => c.role === r)?.n ?? 0;
  return (
    <AdminPage title="Roles and permissions" description="Permissions are enforced on the server for every page and action. Changes apply immediately.">
      <StatGrid cols={4}>
        {[...EDITABLE, "SUPER_ADMIN"].map((r) => (
          <StatsCard key={r} label={humanize(r)} value={`${n(r)} staff`} hint={SCOPE[r]} />
        ))}
      </StatGrid>
      <div id="matrix" className="scroll-mt-20">
        <AdminCard title="Permission matrix" bodyClassName="p-0">
          <PermissionMatrix roles={EDITABLE} permissions={ALL_PERMISSIONS.map((key) => ({ key, label: PERMISSIONS[key] }))} granted={granted} />
        </AdminCard>
      </div>
    </AdminPage>
  );
}
