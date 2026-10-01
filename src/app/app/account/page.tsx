import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Bell, BookOpen, ChevronRight, HeartHandshake, HelpCircle, Inbox, KeyRound, Landmark, LifeBuoy, LogOut, ReceiptText, Repeat, UserRound, Users, Wallet, Wrench } from "lucide-react";
import { db } from "@/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/app/mobile-header";
import { AccountHeader } from "@/components/app/root-page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/permissions";
import { signOutAction } from "@/server/actions/auth";
import { getDailyState } from "@/server/services/daily";
import { unreadCount } from "@/server/services/notifications";
import { levelProgress } from "@/server/services/xp";

export const metadata: Metadata = { title: "Account" };

function Row({ href, icon: Icon, label, meta }: { href: string; icon: typeof Bell; label: string; meta?: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 outline-none hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {meta}
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export default async function AccountPage() {
  const user = await requireUser();
  const [xp, daily, unread] = await Promise.all([levelProgress(db, user.xpTotal, user.xpLevel), getDailyState(user.id), unreadCount(user.id)]);

  return (
    <div>
      <AccountHeader
        name={user.name}
        email={user.email}
        level={user.xpLevel}
        title={xp.current?.title ?? "Explorer"}
        streak={daily.streak.current}
        joined={user.createdAt}
      />
      <Section title="Wallet">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/wallet" icon={Wallet} label="Wallet" />
          <Row href="/app/wallet/deposit" icon={ArrowDownToLine} label="Deposit" />
          <Row href="/app/wallet/convert" icon={Repeat} label="Convert to Credits" />
          <Row href="/app/wallet/withdraw" icon={ArrowUpFromLine} label="Withdraw" />
          <Row href="/app/wallet/transactions" icon={ReceiptText} label="Transactions" />
          <Row href="/app/account/withdrawal-accounts" icon={Landmark} label="Bank accounts" />
        </div>
      </Section>
      <Section title="Personal">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/account/profile" icon={UserRound} label="Profile" />
          <Row href="/app/account/verification" icon={BadgeCheck} label="Verification" meta={<StatusBadge status={user.verificationStatus} />} />
          <Row href="/app/account/security" icon={KeyRound} label="Security" />
        </div>
      </Section>
      <Section title="Settings">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row
            href="/app/notifications"
            icon={Inbox}
            label="Notifications"
            meta={unread > 0 ? <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white tabular">{unread > 9 ? "9+" : unread}</span> : undefined}
          />
          <Row href="/app/account/notifications" icon={Bell} label="Notification settings" />
          <Row href="/app/account/responsible-play" icon={HeartHandshake} label="Responsible play and limits" />
        </div>
      </Section>
      <Section title="Community and rewards">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/referrals" icon={Users} label="Referrals" />
        </div>
      </Section>
      <Section title="Help">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/account/support" icon={LifeBuoy} label="Contact support" />
          <Row href="/faq" icon={HelpCircle} label="FAQ" />
          <Row href="/help" icon={BookOpen} label="Help centre" />
          {isAdminRole(user.role) && <Row href="/admin" icon={Wrench} label="Admin console" />}
        </div>
      </Section>
      <Section>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center justify-center gap-2 h-14 rounded-2xl border bg-card font-semibold text-destructive hover:bg-destructive/5">
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
