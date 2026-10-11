import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Panel, Section } from "@/components/app/mobile-header";
import { NewTicketForm } from "@/components/app/support-forms";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { relativeTime } from "@/lib/time";
import { userTickets } from "@/server/services/support";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await requireUser();
  const tickets = await userTickets(user.id);
  return (
    <div>
      <InnerPageHeader title="Support" subtitle="We usually reply within a few hours" />
      {tickets.length > 0 && (
        <Section title="Your tickets">
          <ul className="divide-y rounded-2xl border bg-card">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/account/support/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-surface">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      #{t.number} {t.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">Updated {relativeTime(t.lastMessageAt)}</p>
                  </div>
                  <StatusBadge status={t.status} label={t.status === "PENDING" ? "Replied" : undefined} />
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="New ticket">
        <Panel>
          <NewTicketForm />
        </Panel>
      </Section>
      <Section>
        <p className="text-center text-xs text-muted-foreground">
          Looking for a quick answer? Try the{" "}
          <Link href="/help" className="font-semibold text-primary underline">
            Help centre
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
