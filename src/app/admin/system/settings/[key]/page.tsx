import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConfigForm } from "@/components/admin/config-form";
import { AdminCard, AdminPage, DiffView } from "@/components/admin/ui";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { CONFIG_DEFAULTS, CONFIG_DESCRIPTIONS, getConfig, type ConfigKey } from "@/server/services/config";

const PAGES: Partial<Record<ConfigKey, { title: string; help?: Record<string, string> }>> = {
  timezone: { title: "Timezone", help: { value: "IANA timezone name. Daily resets, streaks and reports use this timezone." } },
  maintenance: { title: "Maintenance mode", help: { enabled: "Blocks player actions. Staff and the admin console keep working.", message: "Shown to players while maintenance is on" } },
  admin_security: { title: "Admin security", help: { reauthMinutes: "High-risk admin actions require a sign-in within this many minutes" } },
};

export const metadata: Metadata = { title: "Setting" };

export default async function SystemSettingPage({ params }: PageProps<"/admin/system/settings/[key]">) {
  const key = (await params).key as ConfigKey;
  if (!(key in CONFIG_DEFAULTS)) notFound();
  const page = PAGES[key];
  if (!page) redirect(`/admin/economy/settings/${key}`);
  await requireAdmin("system.manage");
  const [value, history] = await Promise.all([
    getConfig(key),
    db.select().from(auditLogs).where(and(eq(auditLogs.entityType, "app_config"), eq(auditLogs.entityId, key))).orderBy(desc(auditLogs.id)).limit(10),
  ]);
  return (
    <AdminPage title={page.title} description={CONFIG_DESCRIPTIONS[key]}>
      <AdminCard>
        <ConfigForm configKey={key} value={value as never} defaults={CONFIG_DEFAULTS[key] as never} help={page.help} />
      </AdminCard>
      <AdminCard title="Change history">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet. Defaults are in effect.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <details key={h.id} className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm">
                  {formatDateTime(h.createdAt)} · {h.actorRole} · <span className="text-muted-foreground">{h.reason}</span>
                </summary>
                <div className="mt-2">
                  <DiffView before={h.before} after={h.after} />
                </div>
              </details>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
