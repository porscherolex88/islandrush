import { BadgeCheck, BookOpen, HeartHandshake, HelpCircle, Inbox, KeyRound, LifeBuoy, Settings, UserRound, Users, Wrench } from "lucide-react";
import type { ComponentProps } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { MenuCard, MenuRow } from "./menu-row";
import { Section } from "./mobile-header";

/** Grouped account menu for the side drawer. Money lives in Wallet, so it is not repeated here. */
export function AccountMenu({ verificationStatus, unread, isAdmin }: { verificationStatus: ComponentProps<typeof StatusBadge>["status"]; unread: number; isAdmin: boolean }) {
  return (
    <>
      <Section title="Account">
        <MenuCard>
          <MenuRow href="/account/profile" icon={UserRound} label="Profile" />
          <MenuRow href="/account/verification" icon={BadgeCheck} label="Verification" meta={<StatusBadge status={verificationStatus} />} />
          <MenuRow href="/account/security" icon={KeyRound} label="Security" />
          <MenuRow
            href="/notifications"
            icon={Inbox}
            label="Notifications"
            meta={unread > 0 ? <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white tabular">{unread > 9 ? "9+" : unread}</span> : undefined}
          />
          <MenuRow href="/account/responsible-play" icon={HeartHandshake} label="Responsible Play" />
          <MenuRow href="/account" icon={Settings} label="Settings" />
        </MenuCard>
      </Section>
      <Section title="Rewards">
        <MenuCard>
          <MenuRow href="/invite" icon={Users} label="Referrals" />
        </MenuCard>
      </Section>
      <Section title="Help">
        <MenuCard>
          <MenuRow href="/account/support" icon={LifeBuoy} label="Contact support" />
          <MenuRow href="/faq" icon={HelpCircle} label="FAQ" />
          <MenuRow href="/help" icon={BookOpen} label="Help centre" />
          {isAdmin && <MenuRow href="/admin" icon={Wrench} label="Admin console" />}
        </MenuCard>
      </Section>
    </>
  );
}
