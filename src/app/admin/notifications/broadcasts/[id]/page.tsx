import { eq, sql } from "drizzle-orm";
import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/actions";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { AdminCard, AdminPage, KeyValue, StatGrid, StatsCard } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { broadcasts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { sendBroadcastNowAction } from "@/server/actions/admin/ops";
import { one } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Broadcast" };

export default async function BroadcastPage({ params }: PageProps<"/admin/notifications/broadcasts/[id]">) {
  await requireAdmin("notifications.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [b] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
  if (!b) notFound();
  const audienceFilter = b.audience === "DEPOSITORS" ? sql`and total_deposits > 0` : b.audience === "NON_DEPOSITORS" ? sql`and total_deposits = 0` : sql``;
  const [reach, delivery] = await Promise.all([
    one<{ n: number }>(sql`select count(*)::int as n from profiles where status = 'ACTIVE' ${audienceFilter}`),
    one<{ sent: number; read: number }>(sql`select count(*)::int as sent, count(read_at)::int as read from notifications where broadcast_id = ${id}`),
  ]);
  const back = `/admin/notifications/broadcasts/${id}`;
  const canSend = !b.sentAt && b.status === "PUBLISHED";

  return (
    <AdminPage
      title={b.title}
      description={b.sentAt ? `Sent ${formatDateTime(b.sentAt)}` : b.scheduledAt ? `Scheduled for ${formatDateTime(b.scheduledAt)}` : "Not scheduled: sends on the next broadcast run once published."}
      actions={
        <>
          <StatusBadge status={b.sentAt ? "SENT" : b.status} />
          {canSend && (
            <ActionButton
              action={sendBroadcastNowAction}
              args={[id]}
              success="Broadcast sent"
              confirm={{ title: "Send this broadcast now?", description: `It will be delivered to about ${reach.n.toLocaleString()} active players. This cannot be undone.`, reasonRequired: false, reasonLabel: "Note (optional)", confirmLabel: "Send now" }}
            >
              Send now
            </ActionButton>
          )}
        </>
      }
    >
      <StatGrid cols={3}>
        <StatsCard label={b.sentAt ? "Recipients" : "Estimated reach"} value={(b.sentAt ? b.recipientCount : reach.n).toLocaleString()} hint={b.audience.replace(/_/g, " ").toLowerCase()} />
        <StatsCard label="Read" value={delivery.read.toLocaleString()} />
        <StatsCard label="Read rate" value={delivery.sent ? `${((delivery.read / delivery.sent) * 100).toFixed(1)}%` : "-"} />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <AdminCard title="Broadcast">
          {b.sentAt ? (
            <KeyValue
              items={[
                ["Audience", b.audience],
                ["Link", b.link ?? "-"],
                ["Sent", formatDateTime(b.sentAt)],
                ["Message", <p key="m" className="whitespace-pre-wrap">{b.body}</p>],
              ]}
              cols={1}
            />
          ) : (
            <ResourceEditor resource="broadcasts" id={id} back={back} />
          )}
        </AdminCard>
        <AdminCard title="Preview" description="How it appears in the notification center">
          <div className="mx-auto max-w-sm rounded-2xl border bg-background p-4 shadow-sm">
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bell className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{b.title}</p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted-foreground">{b.body}</p>
                {b.link && <p className="mt-2 text-xs font-medium text-primary">Open</p>}
              </div>
            </div>
          </div>
          {b.sentAt && <p className="mt-3 text-center text-xs text-muted-foreground">Sent broadcasts are read-only to keep delivery history accurate.</p>}
        </AdminCard>
      </div>
    </AdminPage>
  );
}
