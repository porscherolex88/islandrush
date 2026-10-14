import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/actions";
import { AdminCard, AdminPage, DataTable } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { setFeatureFlagAction } from "@/server/actions/admin/ops";

export const metadata: Metadata = { title: "Feature flags" };

export default async function FeatureFlagsPage() {
  await requireAdmin("system.manage");
  const flags = await db.select().from(featureFlags).orderBy(asc(featureFlags.key));
  return (
    <AdminPage title="Feature flags" description="Switch features on or off instantly. Players see a friendly closed state; balances and inventory are never affected.">
      <AdminCard bodyClassName="p-0">
        <DataTable
          rows={flags}
          rowKey={(f) => f.key}
          empty="No feature flags configured"
          columns={[
            {
              key: "k",
              header: "Feature",
              cell: (f) => (
                <div>
                  <code className="text-xs font-semibold">{f.key}</code>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
              ),
            },
            { key: "s", header: "State", cell: (f) => <StatusBadge status={f.enabled ? "ACTIVE" : "DISABLED"} label={f.enabled ? "On" : "Off"} /> },
            { key: "u", header: "Last changed", cell: (f) => <span className="text-xs">{formatDateTime(f.updatedAt)}</span> },
            {
              key: "x",
              header: "",
              cell: (f) => (
                <div className="flex justify-end">
                  <ActionButton
                    action={setFeatureFlagAction}
                    args={[f.key, !f.enabled]}
                    variant={f.enabled ? "outline" : "default"}
                    success={f.enabled ? "Feature turned off" : "Feature turned on"}
                    confirm={{ title: `Turn ${f.enabled ? "off" : "on"} ${f.key}?`, description: f.enabled ? "Players lose access to this feature immediately." : "Players get access immediately.", reasonLabel: "Reason", destructive: f.enabled, confirmLabel: f.enabled ? "Turn off" : "Turn on" }}
                  >
                    {f.enabled ? "Turn off" : "Turn on"}
                  </ActionButton>
                </div>
              ),
            },
          ]}
        />
      </AdminCard>
    </AdminPage>
  );
}
