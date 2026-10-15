import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppDrawer } from "@/components/app/app-drawer";
import { AppShell } from "@/components/app/app-shell";
import { CountryRestrictedBanner } from "@/components/app/country-banner";
import { requireUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";
import { getConfig } from "@/server/services/config";
import { getRequestCountry, resolveCountryAccess } from "@/server/services/country-access";
import { unreadCount } from "@/server/services/notifications";
// isAdminRole still used for maintenance bypass

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Home", template: "%s | LootBox" }, robots: { index: false } };

export default async function UserAppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const maintenance = await getConfig("maintenance");

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
  const country = (await getRequestCountry()) ?? user.signupCountry;
  const access = await resolveCountryAccess(country);
  let banner: React.ReactNode = null;
  if (user.status === "SUSPENDED") {
    banner = (
      <div role="alert" className="mx-4 mb-1 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Your account is suspended. You can still view your account and{" "}
        <Link href="/account/support" className="font-semibold underline">
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
  } else if (access.banner) {
    banner = <CountryRestrictedBanner message={access.banner} />;
  }

  return (
    <AppShell banner={banner} drawer={<AppDrawer name={user.name} email={user.email} joined={user.createdAt} verificationStatus={user.verificationStatus} isAdmin={false} unread={await unreadCount(user.id)} />}>
      {children}
    </AppShell>
  );
}
