import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, DataTable } from "@/components/admin/ui";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { CONFIG_DEFAULTS, CONFIG_DESCRIPTIONS, type ConfigKey } from "@/server/services/config";

export const metadata: Metadata = { title: "Application settings" };

const SYSTEM_KEYS: ConfigKey[] = ["timezone", "maintenance", "admin_security"];

function settingsHref(key: ConfigKey) {
  return SYSTEM_KEYS.includes(key) ? `/admin/system/settings/${key}` : `/admin/economy/settings/${key}`;
}

export default async function SettingsIndexPage() {
  await requireAdmin("system.manage");
  const stored = await db.select().from(appConfig);
  const keys = Object.keys(CONFIG_DEFAULTS) as ConfigKey[];
  const list = keys.map((key) => ({ key, row: stored.find((s) => s.key === key) }));
  return (
    <AdminPage title="Application settings" description="Global configuration. Settings without a saved value use the built-in defaults. Every change requires a reason and is audited.">
      <AdminCard bodyClassName="p-0">
        <DataTable
          rows={list}
          rowKey={(s) => s.key}
          columns={[
            {
              key: "k",
              header: "Setting",
              cell: (s) => (
                <Link href={settingsHref(s.key)} className="block">
                  <span className="font-medium text-primary hover:underline">{CONFIG_DESCRIPTIONS[s.key]}</span>
                  <code className="block text-[11px] text-muted-foreground">{s.key}</code>
                </Link>
              ),
            },
            { key: "s", header: "Source", cell: (s) => (s.row ? "Customized" : <span className="text-muted-foreground">Default</span>) },
            { key: "u", header: "Last changed", cell: (s) => <span className="text-xs">{s.row ? formatDateTime(s.row.updatedAt) : "-"}</span> },
          ]}
        />
      </AdminCard>
    </AdminPage>
  );
}
