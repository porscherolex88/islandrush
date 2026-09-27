import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SP = Record<string, string | string[] | undefined>;

export function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length ? s : undefined;
}

export function pageOf(sp: SP) {
  const p = Number(str(sp.page) ?? 1);
  return Number.isInteger(p) && p > 0 ? p : 1;
}

export function withQuery(path: string, sp: SP, patch: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = str(v);
    if (s) q.set(k, s);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export function AdminPage({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function AdminCard({ title, description, actions, children, className, bodyClassName }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatsCard({ label, value, hint, href, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "default" | "warning" | "success" | "danger" | "brand" }) {
  const toneCls = {
    default: "",
    warning: "border-l-4 border-l-amber-400",
    success: "border-l-4 border-l-emerald-500",
    danger: "border-l-4 border-l-red-500",
    brand: "border-l-4 border-l-primary",
  }[tone];
  const body = (
    <div className={cn("h-full rounded-xl border bg-card p-4 transition-colors", toneCls, href && "hover:bg-muted/40")}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold tabular">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4", 5: "sm:grid-cols-3 xl:grid-cols-5", 6: "sm:grid-cols-3 xl:grid-cols-6" }[cols];
  return <div className={cn("grid gap-3", c)}>{children}</div>;
}

export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; sortKey?: string; className?: string; align?: "right" | "left" };

export function DataTable<T>({
  rows,
  columns,
  sp,
  basePath,
  rowKey,
  empty = "Nothing to show",
  selectable,
}: {
  rows: T[];
  columns: Column<T>[];
  sp?: SP;
  basePath?: string;
  rowKey: (row: T) => string;
  empty?: string;
  selectable?: string;
}) {
  if (!rows.length) return <EmptyState title={empty} className="py-10" />;
  const sort = sp ? str(sp.sort) : undefined;
  const dir = sp ? str(sp.dir) : undefined;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {selectable && (
              <th className="w-8 px-3 py-2.5">
                <span className="sr-only">Select</span>
              </th>
            )}
            {columns.map((c) => {
              const active = c.sortKey && sort === c.sortKey;
              const nextDir = active && dir !== "asc" ? "asc" : "desc";
              return (
                <th key={c.key} scope="col" className={cn("px-3 py-2.5 font-medium whitespace-nowrap", c.align === "right" && "text-right", c.className)}>
                  {c.sortKey && sp && basePath ? (
                    <Link href={withQuery(basePath, sp, { sort: c.sortKey, dir: nextDir, page: null })} className="inline-flex items-center gap-1 hover:text-foreground">
                      {c.header}
                      {active ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                    </Link>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-muted/30">
              {selectable && (
                <td className="px-3 py-2">
                  <input type="checkbox" name={selectable} value={rowKey(r)} form={`${selectable}-form`} className="size-4 accent-[var(--primary)]" aria-label="Select row" />
                </td>
              )}
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2 align-middle", c.align === "right" && "text-right tabular", c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, hasMore, sp, basePath, total }: { page: number; hasMore: boolean; sp: SP; basePath: string; total?: number }) {
  if (page === 1 && !hasMore) return total !== undefined ? <p className="text-xs text-muted-foreground">{total} result{total === 1 ? "" : "s"}</p> : null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">
        Page {page}
        {total !== undefined && ` · ${total} results`}
      </span>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" disabled={page <= 1} aria-disabled={page <= 1} className={cn(page <= 1 && "pointer-events-none opacity-50")}>
          <Link href={withQuery(basePath, sp, { page: page - 1 })}>
            <ChevronLeft /> Previous
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" aria-disabled={!hasMore} className={cn(!hasMore && "pointer-events-none opacity-50")}>
          <Link href={withQuery(basePath, sp, { page: page + 1 })}>
            Next <ChevronRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function FilterBar({ children, basePath, keep = [] , sp}: { children: ReactNode; basePath: string; keep?: string[]; sp?: SP }) {
  return (
    <form method="get" action={basePath} className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
      {sp && keep.map((k) => (str(sp[k]) ? <input key={k} type="hidden" name={k} value={str(sp[k])} /> : null))}
      {children}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-9">
          Apply
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-9">
          <Link href={basePath}>Reset</Link>
        </Button>
      </div>
    </form>
  );
}

const fieldCls = "h-9 rounded-md border bg-background px-2.5 text-sm";

export function FilterInput({ name, label, value, placeholder, type = "text", className }: { name: string; label: string; value?: string; placeholder?: string; type?: string; className?: string }) {
  return (
    <label className={cn("grid gap-1 text-xs font-medium text-muted-foreground", className)}>
      {label}
      <input name={name} type={type} defaultValue={value} placeholder={placeholder} className={cn(fieldCls, "text-foreground")} />
    </label>
  );
}

export function FilterSelect({ name, label, value, options, allLabel = "All" }: { name: string; label: string; value?: string; options: readonly (string | { value: string; label: string })[]; allLabel?: string }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select name={name} defaultValue={value ?? ""} className={cn(fieldCls, "text-foreground")}>
        <option value="">{allLabel}</option>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function KeyValue({ items, cols = 2 }: { items: [ReactNode, ReactNode][]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 text-sm", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 font-medium break-words">{v ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
  return <pre className="max-h-80 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed">{JSON.stringify(value, null, 2)}</pre>;
}

export function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return <span className="text-muted-foreground">No field changes recorded</span>;
  const fmt = (v: unknown) => (v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="py-1 pr-3 font-medium">Field</th>
          <th className="py-1 pr-3 font-medium">Before</th>
          <th className="py-1 font-medium">After</th>
        </tr>
      </thead>
      <tbody className="divide-y font-mono">
        {keys.map((k) => (
          <tr key={k} className="align-top">
            <td className="py-1.5 pr-3 font-sans font-medium">{k}</td>
            <td className="max-w-xs py-1.5 pr-3 break-all text-red-700">{fmt(b[k])}</td>
            <td className="max-w-xs py-1.5 break-all text-emerald-700">{fmt(a[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Tabs({ tabs, active, basePath, sp }: { tabs: { key: string; label: string; count?: number }[]; active: string; basePath: string; sp: SP }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t.key}
          role="tab"
          aria-selected={t.key === active}
          href={withQuery(basePath, sp, { tab: t.key === tabs[0].key ? null : t.key, page: null })}
          className={cn("-mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground", t.key === active && "border-primary font-medium text-foreground")}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px]">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function UserLink({ id, name, email }: { id: string; name?: string | null; email?: string | null }) {
  return (
    <Link href={`/admin/users/${id}`} className="block min-w-0 hover:underline">
      <span className="block truncate font-medium">{name ?? id.slice(0, 8)}</span>
      {email && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
    </Link>
  );
}
