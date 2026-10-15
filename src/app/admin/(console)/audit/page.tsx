import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DiffView, FilterBar, FilterInput, FilterSelect, Pagination, pageOf, str } from "@/components/admin/ui";
import { EmptyState } from "@/components/shared/states";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Audit logs" };
const PAGE = 50;

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  profile: (id) => `/admin/users/${id}`,
  deposit: (id) => `/admin/finance/deposits/${id}`,
  deposits: (id) => `/admin/finance/deposits/${id}`,
  withdrawal: (id) => `/admin/finance/withdrawals/${id}`,
  withdrawals: (id) => `/admin/finance/withdrawals/${id}`,
  ledger_transaction: (id) => `/admin/finance/ledger/${id}`,
  risk_flag: (id) => `/admin/risk/flags/${id}`,
  support_ticket: (id) => `/admin/support/${id}`,
  app_config: (id) => `/admin/system/settings/${id}`,
  broadcasts: (id) => `/admin/notifications/broadcasts/${id}`,
};

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin("audit.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const actor = str(sp.actor)?.trim();
  const action = str(sp.action)?.trim();
  const entity = str(sp.entity);
  const entityId = str(sp.entityId)?.trim();
  const from = str(sp.from);
  const to = str(sp.to);
  const [list, entities] = await Promise.all([
    rows<{ id: number; created_at: string; actor_id: string | null; actor_role: string | null; actor_name: string | null; action: string; entity_type: string; entity_id: string | null; before: unknown; after: unknown; reason: string | null; ip: string | null }>(sql`
      select a.id, a.created_at::text, a.actor_id, a.actor_role,
        coalesce(aa.display_name, p.name) as actor_name,
        a.action, a.entity_type, a.entity_id, a.before, a.after, a.reason, a.ip
      from audit_logs a
        left join profiles p on p.id = a.actor_id
        left join admin_accounts aa on aa.id::text = a.actor_id
      where true
        ${actor ? (actor.includes("@") ? sql`and (p.email = ${actor.toLowerCase()} or aa.username = ${actor.toLowerCase()})` : sql`and a.actor_id = ${actor}`) : sql``}
        ${action ? sql`and a.action ilike ${`%${action.replace(/[%_]/g, "\\$&")}%`}` : sql``}
        ${entity ? sql`and a.entity_type = ${entity}` : sql``}
        ${entityId ? sql`and a.entity_id = ${entityId}` : sql``}
        ${from ? sql`and a.created_at >= ${new Date(`${from}T00:00:00+08:00`)}` : sql``}
        ${to ? sql`and a.created_at <= ${new Date(`${to}T23:59:59+08:00`)}` : sql``}
      order by a.id desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`),
    rows<{ entity_type: string }>(sql`select distinct entity_type from audit_logs order by 1`),
  ]);
  const shown = list.slice(0, PAGE);

  return (
    <AdminPage title="Audit logs" description="Immutable record of every sensitive action. Entries cannot be edited or deleted, even by Super Admins.">
      <FilterBar basePath="/admin/audit">
        <FilterInput name="actor" label="Actor" value={actor} placeholder="Email or user ID" />
        <FilterInput name="action" label="Action" value={action} placeholder="e.g. deposit.approve" />
        <FilterSelect name="entity" label="Entity" value={entity} options={entities.map((e) => e.entity_type)} />
        <FilterInput name="entityId" label="Entity ID" value={entityId} />
        <FilterInput name="from" label="From" type="date" value={from} />
        <FilterInput name="to" label="To" type="date" value={to} />
      </FilterBar>
      {shown.length === 0 ? (
        <EmptyState title="No audit entries match" className="py-10" />
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {shown.map((a) => {
            const link = a.entity_id ? ENTITY_LINKS[a.entity_type]?.(a.entity_id) : undefined;
            return (
              <details key={a.id} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(a.created_at)}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{a.action}</code>
                  <span className="text-xs">
                    {a.entity_type}
                    {a.entity_id && (
                      <>
                        {" "}
                        {link ? (
                          <Link href={link} className="font-mono text-primary hover:underline">
                            {a.entity_id.slice(0, 12)}
                          </Link>
                        ) : (
                          <span className="font-mono">{a.entity_id.slice(0, 12)}</span>
                        )}
                      </>
                    )}
                  </span>
                  <span className="ml-auto text-xs">
                    {a.actor_id ? (
                      <Link href={`/admin/audit?actor=${a.actor_id}`} className="hover:underline">
                        {a.actor_name ?? a.actor_id.slice(0, 8)}
                      </Link>
                    ) : (
                      "System"
                    )}
                    {a.actor_role && <span className="text-muted-foreground"> · {a.actor_role}</span>}
                  </span>
                  {a.reason && <p className="w-full truncate pl-0 text-xs text-muted-foreground sm:pl-39">Reason: {a.reason}</p>}
                </summary>
                <div className="mt-3 space-y-2">
                  <DiffView before={a.before} after={a.after} />
                  {a.ip && <p className="text-xs text-muted-foreground">IP {a.ip} · entry #{a.id}</p>}
                </div>
              </details>
            );
          })}
        </div>
      )}
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/audit" />
    </AdminPage>
  );
}
