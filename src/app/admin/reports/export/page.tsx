import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, FilterBar, FilterInput } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";
import { parseRange } from "@/server/admin/queries";
import { REPORT_GROUPS, REPORTS } from "@/server/admin/reports";

export const metadata: Metadata = { title: "Export center" };

export default async function ExportCenterPage({ searchParams }: PageProps<"/admin/reports/export">) {
  const admin = await requireAdmin("reports.view");
  const sp = await searchParams;
  const range = parseRange(sp);
  const available = REPORTS.filter((r) => admin.can(r.permission));
  return (
    <AdminPage title="Export center" description="CSV files are generated on the server in chunks, so large periods are safe to export. Every export is recorded in the audit log.">
      <FilterBar basePath="/admin/reports/export">
        <FilterInput name="from" label="From" type="date" value={range.from} />
        <FilterInput name="to" label="To" type="date" value={range.to} />
      </FilterBar>
      <div className="grid gap-4 lg:grid-cols-2">
        {REPORT_GROUPS.map((g) => {
          const list = available.filter((r) => r.group === g.key);
          if (!list.length) return null;
          return (
            <AdminCard key={g.key} title={g.label}>
              <ul className="divide-y">
                {list.map((r) => (
                  <li key={r.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/reports?group=${g.key}&report=${r.key}&from=${range.from}&to=${range.to}`} className="font-medium hover:underline">
                        {r.label}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{r.description}</p>
                    </div>
                    <a href={`/api/admin/reports/${r.key}?from=${range.from}&to=${range.to}`} className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                      <Download className="size-3.5" /> CSV
                    </a>
                  </li>
                ))}
              </ul>
            </AdminCard>
          );
        })}
      </div>
    </AdminPage>
  );
}
