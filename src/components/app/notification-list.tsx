"use client";

import { Bell, BookOpen, CheckCheck, Gift, Loader2, type LucideIcon, Megaphone, Target, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useAction } from "@/hooks/use-action";
import { relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/actions/account";
import { headerPillButton } from "./header-buttons";

const TYPE_ICON: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  REWARD: { icon: Gift, tone: "bg-gold-soft text-gold-foreground", label: "Reward" },
  MISSION: { icon: Target, tone: "bg-brand-soft text-primary", label: "Mission" },
  COLLECTION: { icon: BookOpen, tone: "bg-amber-100 text-amber-800", label: "Collection" },
  REFERRAL: { icon: Users, tone: "bg-violet-100 text-violet-700", label: "Referral" },
  WALLET: { icon: Wallet, tone: "bg-success-soft text-success", label: "Wallet" },
  SYSTEM: { icon: Megaphone, tone: "bg-orange-100 text-orange-700", label: "LootBox" },
};
const FALLBACK = { icon: Bell, tone: "bg-muted text-muted-foreground", label: "Update" };

export type NotificationView = { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };
export type NotificationGroup = { label: string; items: NotificationView[] };

function NotificationCard({ n, onRead }: { n: NotificationView; onRead: (id: string) => void }) {
  const t = TYPE_ICON[n.type] ?? FALLBACK;
  const Icon = t.icon;
  const unread = !n.readAt;
  const inner = (
    <>
      <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-full", t.tone)} aria-hidden>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <span className="">{t.label}</span>
          <span aria-hidden>·</span>
          <span suppressHydrationWarning>{relativeTime(new Date(n.createdAt))}</span>
          {unread && (
            <span className="ml-auto flex items-center gap-1 text-primary">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              <span className="sr-only">Unread</span>
            </span>
          )}
        </span>
        <span className={cn("mt-0.5 block text-[15px] leading-snug", unread ? "font-bold text-foreground" : "font-semibold text-foreground/80")}>{n.title}</span>
        <span className={cn("mt-0.5 line-clamp-2 block text-sm leading-snug", unread ? "text-muted-foreground" : "text-muted-foreground/80")}>{n.body}</span>
      </span>
    </>
  );
  const cls = cn(
    "flex w-full gap-3 rounded-2xl border p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    unread ? "bg-card hover:bg-surface" : "border-transparent bg-surface/70 hover:bg-surface",
  );
  return n.link ? (
    <Link href={n.link} onClick={() => unread && onRead(n.id)} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={() => unread && onRead(n.id)} className={cls}>
      {inner}
    </button>
  );
}

export function NotificationList({ groups }: { groups: NotificationGroup[] }) {
  const { run } = useAction(markNotificationsReadAction);
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h2 className="mb-2 px-1 text-xs font-bold text-muted-foreground">{g.label}</h2>
          <ul className="space-y-2">
            {g.items.map((n) => (
              <li key={n.id}>
                <NotificationCard n={n} onRead={(id) => run(id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function MarkAllReadButton() {
  const { run, pending } = useAction(markNotificationsReadAction, { success: "All caught up" });
  return (
    <button type="button" onClick={() => run()} disabled={pending} className={cn(headerPillButton, "text-primary")} aria-label="Mark all notifications as read">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
      Read all
    </button>
  );
}
