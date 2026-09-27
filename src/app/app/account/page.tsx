import { Bell, ChevronRight, CreditCard, HeartHandshake, HelpCircle, Landmark, LifeBuoy, LogOut, ShieldCheck, UserRound, Wallet, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { requireUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/permissions";
import { formatDate } from "@/lib/time";
import { signOutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Account" };

function Row({ href, icon: Icon, label, meta }: { href: string; icon: typeof Bell; label: string; meta?: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface">
      <Icon className="size-5 text-muted-foreground" aria-hidden />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {meta}
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export default async function AccountPage() {
  const user = await requireUser();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <PageHeader title="Account" />
      <Section>
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
          <Avatar className="size-14">
            <AvatarFallback className="bg-brand-soft font-heading text-lg font-bold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-lg font-bold">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">Member since {formatDate(user.createdAt)}</p>
          </div>
        </div>
      </Section>
      <Section title="Profile and security">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/account/profile" icon={UserRound} label="Profile" />
          <Row href="/app/account/security" icon={ShieldCheck} label="Password and sessions" />
          <Row href="/app/account/verification" icon={ShieldCheck} label="Verification" meta={<StatusBadge status={user.verificationStatus} />} />
        </div>
      </Section>
      <Section title="Money">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/wallet" icon={Wallet} label="Wallet" />
          <Row href="/app/account/withdrawal-accounts" icon={Landmark} label="Withdrawal accounts" />
          <Row href="/app/wallet/deposit" icon={CreditCard} label="Payment details" />
        </div>
      </Section>
      <Section title="Preferences">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/account/notifications" icon={Bell} label="Notification settings" />
          <Row href="/app/account/responsible-play" icon={HeartHandshake} label="Responsible play and limits" />
        </div>
      </Section>
      <Section title="Help">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/account/support" icon={LifeBuoy} label="Support tickets" />
          <Row href="/help" icon={HelpCircle} label="Help centre" />
          <Row href="/faq" icon={HelpCircle} label="FAQ" />
          {isAdminRole(user.role) && <Row href="/admin" icon={Wrench} label="Admin console" />}
        </div>
      </Section>
      <Section>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl border bg-card py-3.5 text-sm font-semibold text-destructive hover:bg-destructive/5">
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/responsible-play" className="underline">
            Responsible play
          </Link>
        </p>
      </Section>
    </div>
  );
}
