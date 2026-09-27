import { asc, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffReplyBox, TicketSettings } from "@/components/admin/support-controls";
import { AdminCard, AdminPage, KeyValue, UserLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { profiles, supportMessages, supportTickets } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { one } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const admin = await requireAdmin("support.view");
  const canManage = admin.can("support.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  if (!ticket) notFound();
  const [messages, user, context, others, assignee] = await Promise.all([
    db
      .select({ m: supportMessages, author: profiles.name, role: profiles.role })
      .from(supportMessages)
      .innerJoin(profiles, eq(profiles.id, supportMessages.authorId))
      .where(eq(supportMessages.ticketId, id))
      .orderBy(asc(supportMessages.createdAt)),
    db.select().from(profiles).where(eq(profiles.id, ticket.userId)).then((r) => r[0]),
    one<{ cash: string; withdrawable: string; pending_deposits: number; open_withdrawals: number; open_flags: number; level: string | null }>(sql`
      select
        coalesce((select balance from financial_accounts where user_id = ${ticket.userId} and type = 'CASH'), 0)::text as cash,
        coalesce((select balance from financial_accounts where user_id = ${ticket.userId} and type = 'WITHDRAWABLE'), 0)::text as withdrawable,
        (select count(*)::int from deposits where user_id = ${ticket.userId} and status = 'PENDING') as pending_deposits,
        (select count(*)::int from withdrawals where user_id = ${ticket.userId} and status in ('PENDING', 'REVIEW', 'APPROVED', 'PROCESSING')) as open_withdrawals,
        (select count(*)::int from risk_flags where user_id = ${ticket.userId} and status in ('OPEN', 'IN_REVIEW')) as open_flags,
        (select l.name from deposit_levels l join profiles p on p.deposit_level_id = l.id where p.id = ${ticket.userId}) as level`),
    db.select({ id: supportTickets.id, number: supportTickets.number, subject: supportTickets.subject, status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.userId, ticket.userId)).orderBy(desc(supportTickets.createdAt)).limit(8),
    ticket.assignedToId ? db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, ticket.assignedToId)).then((r) => r[0]?.name ?? null) : Promise.resolve(null),
  ]);
  const closed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <AdminPage
      title={`#${ticket.number} ${ticket.subject}`}
      description={`${ticket.category.toLowerCase()} · opened ${formatDateTime(ticket.createdAt)}${assignee ? ` · assigned to ${assignee}` : " · unassigned"}`}
      actions={
        <>
          <StatusBadge status={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <AdminCard title="Conversation">
            <ol className="space-y-3">
              {messages.map(({ m, author }) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-xl border p-3 text-sm",
                    m.isInternal ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20" : m.fromStaff ? "ml-6 bg-primary/5" : "mr-6",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {author}
                      {m.isInternal ? " · internal note" : m.fromStaff ? " · staff" : ""}
                    </span>
                    <span>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ol>
          </AdminCard>
          {canManage && (
            <AdminCard title="Reply">
              <StaffReplyBox ticketId={id} closed={closed} />
            </AdminCard>
          )}
        </div>
        <div className="space-y-4">
          {canManage && (
            <AdminCard title="Ticket">
              <TicketSettings ticketId={id} status={ticket.status} priority={ticket.priority} tags={ticket.tags} resolution={ticket.resolution} assignedToMe={ticket.assignedToId === admin.user.id} assigned={Boolean(ticket.assignedToId)} />
            </AdminCard>
          )}
          {user && (
            <AdminCard title="User context" actions={<Button asChild size="sm" variant="outline"><Link href={`/admin/users/${user.id}`}>Profile</Link></Button>}>
              <UserLink id={user.id} name={user.name} email={user.email} />
              <div className="mt-3">
                <KeyValue
                  items={[
                    ["Status", <StatusBadge key="s" status={user.status} />],
                    ["Verification", <StatusBadge key="v" status={user.verificationStatus} />],
                    ["Joined", formatDateTime(user.createdAt)],
                    ["Deposit Level", context.level ?? "-"],
                    ["Cash", formatMYR(context.cash)],
                    ["Withdrawable", formatMYR(context.withdrawable)],
                    ["Pending deposits", context.pending_deposits ? <Link key="d" href={`/admin/users/${user.id}?tab=deposits`} className="text-primary hover:underline">{context.pending_deposits}</Link> : "0"],
                    ["Open withdrawals", context.open_withdrawals ? <Link key="w" href={`/admin/users/${user.id}?tab=withdrawals`} className="text-primary hover:underline">{context.open_withdrawals}</Link> : "0"],
                    ["Active risk flags", context.open_flags],
                  ]}
                  cols={1}
                />
              </div>
            </AdminCard>
          )}
          <AdminCard title="Other tickets from this user">
            <ul className="space-y-1.5 text-sm">
              {others.filter((o) => o.id !== id).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/support/${o.id}`} className="truncate text-primary hover:underline">
                    #{o.number} {o.subject}
                  </Link>
                  <StatusBadge status={o.status} />
                </li>
              ))}
              {others.length <= 1 && <li className="text-muted-foreground">None</li>}
            </ul>
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}
