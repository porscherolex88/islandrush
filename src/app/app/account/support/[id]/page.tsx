import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { TicketReplyForm } from "@/components/app/support-forms";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ticketThread } from "@/server/services/support";

export const metadata: Metadata = { title: "Support Ticket" };

export default async function TicketPage({ params }: PageProps<"/app/account/support/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const thread = await ticketThread(id, { includeInternal: false }).catch(() => null);
  if (!thread || thread.ticket.userId !== user.id) notFound();
  const { ticket, messages } = thread;

  return (
    <div>
      <InnerPageHeader title={ticket.subject} subtitle={`Ticket #${ticket.number}`} action={<StatusBadge status={ticket.status} className="mr-2" />} />
      <Section>
        <ol className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={cn("flex", m.fromStaff ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", m.fromStaff ? "rounded-bl-md bg-surface" : "rounded-br-md bg-primary text-primary-foreground")}>
                <p className="text-[11px] font-semibold opacity-70">{m.fromStaff ? "LootBox Support" : "You"}</p>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-60">{formatDateTime(m.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
        {ticket.resolution && <p className="mt-3 rounded-xl bg-success-soft p-3 text-sm">Resolution: {ticket.resolution}</p>}
      </Section>
      <Section>
        <TicketReplyForm ticketId={ticket.id} closed={ticket.status === "CLOSED"} />
      </Section>
    </div>
  );
}
