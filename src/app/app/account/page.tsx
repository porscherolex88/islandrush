import { BadgeCheck, Bell, HeartHandshake, KeyRound, Landmark, LogOut, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { MenuCard, MenuRow } from "@/components/app/menu-row";
import { Section } from "@/components/app/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { signOutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div>
      <InnerPageHeader title="Settings" subtitle={user.email} />
      <Section title="Account">
        <MenuCard>
          <MenuRow href="/app/account/profile" icon={UserRound} label="Profile" />
          <MenuRow href="/app/account/verification" icon={BadgeCheck} label="Verification" meta={<StatusBadge status={user.verificationStatus} />} />
          <MenuRow href="/app/account/security" icon={KeyRound} label="Security" />
        </MenuCard>
      </Section>
      <Section title="Notifications">
        <MenuCard>
          <MenuRow href="/app/account/notifications" icon={Bell} label="Notification settings" />
        </MenuCard>
      </Section>
      <Section title="Play">
        <MenuCard>
          <MenuRow href="/app/account/responsible-play" icon={HeartHandshake} label="Responsible play and limits" />
        </MenuCard>
      </Section>
      <Section title="Payments">
        <MenuCard>
          <MenuRow href="/app/account/withdrawal-accounts" icon={Landmark} label="Bank accounts" />
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
