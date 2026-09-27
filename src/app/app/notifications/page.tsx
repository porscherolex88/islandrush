import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { MarkAllReadButton, NotificationList } from "@/components/app/notification-list";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Notifications" };
const PAGE = 30;

export default async function NotificationsPage({ searchParams }: PageProps<"/app/notifications">) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await listNotifications(user.id, PAGE + 1, (page - 1) * PAGE);
  const items = rows.slice(0, PAGE).map((n) => ({
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
      <PageHeader title="Notifications" back="/app" action={items.some((i) => !i.readAt) ? <MarkAllReadButton /> : undefined} />
      <Section>
        {items.length === 0 ? <EmptyState icon="🔔" title="No notifications yet" description="Rewards, wallet updates and news will show up here." /> : <NotificationList items={items} />}
        {(page > 1 || rows.length > PAGE) && (
          <div className="mt-3 flex justify-between">
            {page > 1 ? (
              <Button asChild variant="outline">
                <Link href={`?page=${page - 1}`}>Newer</Link>
              </Button>
            ) : (
              <span />
            )}
            {rows.length > PAGE && (
              <Button asChild variant="outline">
                <Link href={`?page=${page + 1}`}>Older</Link>
              </Button>
            )}
          </div>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Choose what you hear about in{" "}
          <Link href="/app/account/notifications" className="font-semibold text-primary underline">
            notification settings
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
