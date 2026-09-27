"use client";

import { Bell, BookOpen, Gift, type LucideIcon, Megaphone, Target, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useAction } from "@/hooks/use-action";
import { relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/actions/account";

const TYPE_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  REWARD: { icon: Gift, tone: "bg-gold-soft text-gold-foreground" },
  MISSION: { icon: Target, tone: "bg-brand-soft text-primary" },
  COLLECTION: { icon: BookOpen, tone: "bg-gold-soft text-gold-foreground" },
  REFERRAL: { icon: Users, tone: "bg-success-soft text-success" },
  WALLET: { icon: Wallet, tone: "bg-success-soft text-success" },
  SYSTEM: { icon: Megaphone, tone: "bg-surface text-muted-foreground" },
};

export type NotificationView = { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

export function NotificationList({ items }: { items: NotificationView[] }) {
  const { run } = useAction(markNotificationsReadAction);
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {items.map((n) => {
        const t = TYPE_ICON[n.type] ?? { icon: Bell, tone: "bg-surface text-muted-foreground" };
        const Icon = t.icon;
        const inner = (
          <>
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", t.tone)} aria-hidden>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", n.readAt ? "font-medium" : "font-bold")}>{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground" suppressHydrationWarning>{relativeTime(new Date(n.createdAt))}</p>
            </div>
            {!n.readAt && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          </>
        );
        return (
          <li key={n.id}>
            {n.link ? (
              <Link href={n.link} onClick={() => !n.readAt && run(n.id)} className={cn("flex gap-3 p-3.5 hover:bg-surface", !n.readAt && "bg-brand-soft/40")}>
                {inner}
              </Link>
            ) : (
              <button type="button" onClick={() => !n.readAt && run(n.id)} className={cn("flex w-full gap-3 p-3.5 text-left hover:bg-surface", !n.readAt && "bg-brand-soft/40")}>
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MarkAllReadButton() {
  const { run, pending } = useAction(markNotificationsReadAction, { success: "All caught up" });
  return (
    <button type="button" onClick={() => run()} disabled={pending} className="flex h-11 items-center text-sm font-semibold text-primary disabled:opacity-50">
      Mark all read
    </button>
  );
}
