import { BadgeCheck, Bell, BookOpen, ChevronRight, CreditCard, Flame, HeartHandshake, HelpCircle, KeyRound, Landmark, LifeBuoy, LogOut, MonitorSmartphone, Star, UserRound, Users, Wallet, Wrench } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userStreaks } from "@/db/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { requireUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/permissions";
import { signOutAction } from "@/server/actions/auth";
import { levelProgress } from "@/server/services/xp";

export const metadata: Metadata = { title: "Account" };

function Row({ href, icon: Icon, label, meta }: { href: string; icon: typeof Bell; label: string; meta?: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface">
      <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-primary">
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
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [xp, [streak]] = await Promise.all([levelProgress(db, user.xpTotal, user.xpLevel), db.select().from(userStreaks).where(eq(userStreaks.userId, user.id)).limit(1)]);

  return (
    <div>
      <PageHeader title="Account" />
      <Section>
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_0%,oklch(0.52_0.1_200),oklch(0.3_0.07_222)_75%)] p-5 text-white shadow-lift">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 ring-4 ring-white/20">
              <AvatarFallback className="bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.72_0.16_65))] font-heading text-xl font-extrabold text-amber-950">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-2xl font-extrabold">{user.name}</p>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                <Star className="size-4" aria-hidden /> Level {user.xpLevel} · {xp.current?.title ?? "Explorer"}
              </p>
              <p className="truncate text-xs text-white/70">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5">
              <Flame className="size-4 text-amber-300" aria-hidden />
              <span>
                <strong>{streak?.current ?? 0}</strong> day streak
              </span>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2.5 whitespace-nowrap text-white/85">Joined {user.createdAt.toLocaleDateString("en-MY", { month: "short", year: "numeric" })}</div>
          </div>
        </div>
      </Section>
      <Section title="Personal">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/account/profile" icon={UserRound} label="Profile" />
          <Row href="/app/account/verification" icon={BadgeCheck} label="Verification" meta={<StatusBadge status={user.verificationStatus} />} />
        </div>
      </Section>
      <Section title="Money">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/wallet" icon={Wallet} label="Wallet" />
          <Row href="/app/account/withdrawal-accounts" icon={Landmark} label="Bank accounts" />
          <Row href="/app/wallet/deposit" icon={CreditCard} label="Payment details" />
          <Row href="/app/referrals" icon={Users} label="Invite friends" />
        </div>
      </Section>
      <Section title="Security">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/account/security" icon={KeyRound} label="Password" />
          <Row href="/app/account/security#sessions" icon={MonitorSmartphone} label="Signed-in devices" />
        </div>
      </Section>
      <Section title="Preferences">
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          <Row href="/app/account/notifications" icon={Bell} label="Notifications" />
          <Row href="/app/account/responsible-play" icon={HeartHandshake} label="Responsible play and limits" />
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
