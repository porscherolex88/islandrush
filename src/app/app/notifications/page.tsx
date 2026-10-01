import { BellRing, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { MarkAllReadButton, NotificationList, type NotificationGroup, type NotificationView } from "@/components/app/notification-list";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getTimezone } from "@/server/services/config";
import { listNotifications, unreadCount } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Notifications" };
const PAGE = 30;

function groupByDay(items: NotificationView[], timeZone: string): NotificationGroup[] {
  const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const today = key(new Date());
  const yesterday = key(new Date(Date.now() - 86_400_000));
  const groups: NotificationGroup[] = [];
  for (const n of items) {
    const k = key(new Date(n.createdAt));
    const label = k === today ? "Today" : k === yesterday ? "Yesterday" : "Earlier";
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

export default async function NotificationsPage({ searchParams }: PageProps<"/app/notifications">) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [rows, unread, tz] = await Promise.all([listNotifications(user.id, PAGE + 1, (page - 1) * PAGE), unreadCount(user.id), getTimezone()]);
  const items: NotificationView[] = rows.slice(0, PAGE).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div>
      <InnerPageHeader
        title="Notifications"
        subtitle={items.length ? (unread ? `${unread} unread` : "You're all caught up") : undefined}
        action={unread > 0 ? <MarkAllReadButton /> : undefined}
      />
      <Section className="pt-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-14 pb-8 text-center">
            <span className="relative grid size-24 place-items-center rounded-full bg-brand-soft" aria-hidden>
              <span className="absolute inset-2 rounded-full border-2 border-dashed border-primary/20" />
              <BellRing className="size-10 text-primary" strokeWidth={1.75} />
            </span>
            <p className="mt-5 font-heading text-xl font-extrabold">No notifications yet</p>
            <p className="mt-1 max-w-64 text-sm text-muted-foreground">Rewards, wallet updates and island news will land here.</p>
          </div>
        ) : (
          <NotificationList groups={groupByDay(items, tz)} />
        )}

        {(page > 1 || rows.length > PAGE) && (
          <div className="mt-4 flex justify-between">
            {page > 1 ? (
              <Button asChild variant="outline" size="pill">
                <Link href={`?page=${page - 1}`}>Newer</Link>
              </Button>
            ) : (
              <span />
            )}
            {rows.length > PAGE && (
              <Button asChild variant="outline" size="pill">
                <Link href={`?page=${page + 1}`}>Older</Link>
              </Button>
            )}
          </div>
        )}

        <Link
          href="/app/account/notifications"
          className="mt-6 flex min-h-14 items-center gap-3 rounded-2xl border border-dashed bg-surface/60 px-4 py-3 transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-muted-foreground" aria-hidden>
            <Settings2 className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Notification settings</span>
            <span className="block text-xs text-muted-foreground">Choose what you hear about</span>
          </span>
        </Link>
      </Section>
    </div>
  );
}
