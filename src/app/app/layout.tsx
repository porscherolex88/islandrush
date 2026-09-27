import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";
import { getConfig } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";
import { unreadCount } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Home", template: "%s | LootBox" }, robots: { index: false } };

export default async function UserAppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  const [balances, unread, maintenance] = await Promise.all([getBalances(user.id), unreadCount(user.id), getConfig("maintenance")]);

  if (maintenance.enabled && !isAdminRole(user.role)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface p-6 text-center">
        <div className="max-w-sm space-y-3">
          <Wrench className="mx-auto size-12 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold">Back shortly</h1>
          <p className="text-muted-foreground">{maintenance.message}</p>
          <p className="text-sm text-muted-foreground">Your balances and progress are safe.</p>
        </div>
      </div>
    );
  }

  const breakUntil = user.playLimits.selfExcludedUntil ? new Date(user.playLimits.selfExcludedUntil) : null;
  let banner: React.ReactNode = null;
  if (user.status === "SUSPENDED") {
    banner = (
      <div role="alert" className="mx-4 mb-1 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Your account is suspended. You can still view your account and{" "}
        <Link href="/app/account/support" className="font-semibold underline">
          contact support
        </Link>
        .
      </div>
    );
  } else if (breakUntil && breakUntil > new Date()) {
    banner = (
      <div role="status" className="mx-4 mb-1 rounded-xl bg-brand-soft px-3 py-2 text-sm text-primary">
        You&apos;re on a play break until {formatDateTime(breakUntil)}. Games are paused; your wallet remains available.
      </div>
    );
  }

  return (
    <AppShell credits={balances.CREDITS} withdrawable={balances.WITHDRAWABLE} unread={unread} banner={banner}>
      {children}
    </AppShell>
  );
}
