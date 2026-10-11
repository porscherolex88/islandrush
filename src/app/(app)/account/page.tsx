import { BadgeCheck, Bell, HeartHandshake, KeyRound, LifeBuoy, LogOut, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { MenuCard, MenuRow } from "@/components/app/menu-row";
import { Section } from "@/components/app/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { signOutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div>
      <InnerPageHeader title="Account" subtitle={user.email} />
      <Section title="Account">
        <MenuCard>
          <MenuRow href="/account/profile" icon={UserRound} label="Profile" />
          <MenuRow href="/account/verification" icon={BadgeCheck} label="Verification" meta={<StatusBadge status={user.verificationStatus} />} />
          <MenuRow href="/account/security" icon={KeyRound} label="Security" />
          <MenuRow href="/account/notifications" icon={Bell} label="Notification settings" />
          <MenuRow href="/account/responsible-play" icon={HeartHandshake} label="Responsible Play and limits" />
          <MenuRow href="/account/support" icon={LifeBuoy} label="Help and support" />
        </MenuCard>
      </Section>
      <Section title="Rewards">
        <MenuCard>
          <MenuRow href="/invite" icon={Users} label="Referrals" />
        </MenuCard>
      </Section>
      <Section>
        <form action={signOutAction}>
          <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border bg-card font-semibold text-destructive hover:bg-destructive/5">
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </form>
      </Section>
    </div>
  );
}
