import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, UserLink, pageOf, str } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Internal notes" };
const PAGE = 50;

export default async function InternalNotesPage({ searchParams }: PageProps<"/admin/support/notes">) {
  await requireAdmin("support.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const kind = str(sp.kind);
  const q = str(sp.q)?.trim();
  const like = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
  const list = await rows<{ id: string; kind: string; body: string; created_at: string; author: string; user_id: string; name: string; email: string; ticket_id: string | null; ticket_number: number | null }>(sql`
    select * from (
      select m.id::text, 'Ticket' as kind, m.body, m.created_at, a.name as author, p.id as user_id, p.name, p.email, t.id::text as ticket_id, t.number as ticket_number
      from support_messages m join support_tickets t on t.id = m.ticket_id join profiles a on a.id = m.author_id join profiles p on p.id = t.user_id
      where m.is_internal
      union all
      select n.id::text, 'User', n.body, n.created_at, a.name, p.id, p.name, p.email, null, null
      from user_notes n join profiles a on a.id = n.author_id join profiles p on p.id = n.user_id
    ) x
    where true
      ${kind === "Ticket" || kind === "User" ? sql`and kind = ${kind}` : sql``}
      ${like ? sql`and (body ilike ${like} or email ilike ${like} or name ilike ${like} or author ilike ${like})` : sql``}
    order by created_at desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`);
  const shown = list.slice(0, PAGE);
  return (
    <AdminPage title="Internal notes" description="Staff-only notes on tickets and user accounts. Players never see these.">
      <FilterBar basePath="/admin/support/notes">
        <FilterSelect name="kind" label="On" value={kind} options={[{ value: "Ticket", label: "Tickets" }, { value: "User", label: "User accounts" }]} />
        <FilterInput name="q" label="Search" value={q} placeholder="Text, user or author" />
      </FilterBar>
      <DataTable
        rows={shown}
        rowKey={(n) => `${n.kind}-${n.id}`}
        empty="No internal notes"
        columns={[
          { key: "t", header: "Written", cell: (n) => <span className="whitespace-nowrap text-xs">{formatDateTime(n.created_at)}</span> },
          { key: "a", header: "Author", cell: (n) => n.author },
          { key: "u", header: "About", cell: (n) => <UserLink id={n.user_id} name={n.name} email={n.email} /> },
          { key: "k", header: "On", cell: (n) => (n.ticket_id ? <Link href={`/admin/support/${n.ticket_id}`} className="text-primary hover:underline">Ticket #{n.ticket_number}</Link> : <Link href={`/admin/users/${n.user_id}`} className="text-primary hover:underline">Account</Link>) },
          { key: "b", header: "Note", cell: (n) => <p className="line-clamp-3 max-w-xl whitespace-pre-wrap">{n.body}</p> },
        ]}
      />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/support/notes" />
    </AdminPage>
  );
}
