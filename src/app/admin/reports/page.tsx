import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, pageOf, str } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay, type FiatDisplay } from "@/lib/fiat-display";
import { formatDate, formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { parseRange, rows } from "@/server/admin/queries";
import { REPORT_GROUPS, REPORTS, reportPage, type ReportFormat, type ReportGroup } from "@/server/admin/reports";

export const metadata: Metadata = { title: "Reports" };
const PAGE = 100;

function fmt(v: unknown, f: ReportFormat | undefined, fiat: FiatDisplay) {
  if (v === null || v === undefined || v === "") return "-";
  switch (f) {
    case "money":
      return formatCash(String(v), { currency: fiat });
    case "credits":
      return formatCredits(Math.round(Number(v)));
    case "int":
      return Number(v).toLocaleString();
    case "pct":
      return `${Number(v).toFixed(1)}%`;
    case "date":
      return formatDate(v as string);
    case "datetime":
      return formatDateTime(v as string);
    default:
      return String(v);
  }
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const fiat = await getFiatDisplay();
  const admin = await requireAdmin("reports.view");
  const sp = await searchParams;
  const available = REPORTS.filter((r) => admin.can(r.permission));
  const groupKey = (str(sp.group) as ReportGroup | undefined) ?? "finance";
  const inGroup = available.filter((r) => r.group === groupKey);
  const def = inGroup.find((r) => r.key === str(sp.report)) ?? inGroup[0];
  const range = parseRange(sp);
  const status = str(sp.status);
  const page = pageOf(sp);
  const data = def ? await rows<Record<string, unknown>>(reportPage(def, range, { status }, PAGE + 1, (page - 1) * PAGE)) : [];
  const shown = data.slice(0, PAGE).map((row, i) => ({ ...row, __key: String((page - 1) * PAGE + i) }));
  const group = REPORT_GROUPS.find((g) => g.key === groupKey);
  const csv = def ? `/api/admin/reports/${def.key}?from=${range.from}&to=${range.to}${status ? `&status=${status}` : ""}` : "#";

  return (
    <AdminPage
      title={`${group?.label ?? "Reports"} reports`}
      description={def?.description}
      actions={
        def && (
          <Button asChild variant="outline">
            <a href={csv}>
              <Download /> Export CSV
            </a>
          </Button>
        )
      }
    >
      <nav className="flex flex-wrap gap-1.5" aria-label="Report groups">
        {REPORT_GROUPS.filter((g) => available.some((r) => r.group === g.key)).map((g) => (
          <Link key={g.key} href={`/admin/reports?group=${g.key}&from=${range.from}&to=${range.to}`} className={cn("rounded-full border px-3 py-1 text-sm", g.key === groupKey ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {g.label}
          </Link>
        ))}
      </nav>
      {!def ? (
        <AdminCard>
          <p className="text-sm text-muted-foreground">You do not have access to reports in this group.</p>
        </AdminCard>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b">
            {inGroup.map((r) => (
              <Link
                key={r.key}
                href={`/admin/reports?group=${groupKey}&report=${r.key}&from=${range.from}&to=${range.to}`}
                className={cn("-mb-px border-b-2 px-3 py-2 text-sm", r.key === def.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {r.label}
              </Link>
            ))}
          </div>
          <FilterBar basePath="/admin/reports" keep={["group", "report"]} sp={{ ...sp, group: groupKey, report: def.key }}>
            <FilterInput name="from" label="From" type="date" value={range.from} />
            <FilterInput name="to" label="To" type="date" value={range.to} />
            {def.statuses && <FilterSelect name="status" label="Status" value={status} options={def.statuses} />}
          </FilterBar>
          <DataTable
            rows={shown}
            rowKey={(row) => row.__key}
            empty="No data for this period"
            columns={def.columns.map((c) => ({
              key: c.key,
              header: c.label,
              align: c.format && ["int", "money", "credits", "pct"].includes(c.format) ? ("right" as const) : undefined,
              cell: (row: Record<string, unknown>) => <span className="whitespace-nowrap">{fmt(row[c.key], c.format, fiat)}</span>,
            }))}
          />
          <Pagination page={page} hasMore={data.length > PAGE} sp={sp} basePath="/admin/reports" />
        </>
      )}
    </AdminPage>
  );
}
