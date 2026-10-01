import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Bell, BookOpen, HeartHandshake, HelpCircle, Inbox, KeyRound, Landmark, LifeBuoy, ReceiptText, Repeat, UserRound, Users, Wallet, Wrench } from "lucide-react";
import type { ComponentProps } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { MenuCard, MenuRow } from "./menu-row";
import { Section } from "./mobile-header";

/** Grouped account menu sections for the side drawer; `hide` drops whole sections. */
export function AccountMenu({
  verificationStatus,
  unread,
  isAdmin,
  hide = [],
}: {
  verificationStatus: ComponentProps<typeof StatusBadge>["status"];
  unread: number;
  isAdmin: boolean;
  hide?: ("wallet" | "personal" | "settings")[];
}) {
  return (
    <>
      {!hide.includes("wallet") && (
        <Section title="Wallet">
          <MenuCard>
            <MenuRow href="/app/wallet" icon={Wallet} label="Wallet" />
            <MenuRow href="/app/wallet/deposit" icon={ArrowDownToLine} label="Deposit" />
            <MenuRow href="/app/wallet/convert" icon={Repeat} label="Convert to Credits" />
            <MenuRow href="/app/wallet/withdraw" icon={ArrowUpFromLine} label="Withdraw" />
            <MenuRow href="/app/wallet/transactions" icon={ReceiptText} label="Transactions" />
            <MenuRow href="/app/account/withdrawal-accounts" icon={Landmark} label="Bank accounts" />
          </MenuCard>
        </Section>
      )}
      {!hide.includes("personal") && (
        <Section title="Personal">
          <MenuCard>
            <MenuRow href="/app/account/profile" icon={UserRound} label="Profile" />
            <MenuRow href="/app/account/verification" icon={BadgeCheck} label="Verification" meta={<StatusBadge status={verificationStatus} />} />
            <MenuRow href="/app/account/security" icon={KeyRound} label="Security" />
          </MenuCard>
        </Section>
      )}
      {!hide.includes("settings") && (
        <Section title="Settings">
          <MenuCard>
            <MenuRow
              href="/app/notifications"
              icon={Inbox}
              label="Notifications"
              meta={unread > 0 ? <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white tabular">{unread > 9 ? "9+" : unread}</span> : undefined}
            />
            <MenuRow href="/app/account/notifications" icon={Bell} label="Notification settings" />
            <MenuRow href="/app/account/responsible-play" icon={HeartHandshake} label="Responsible play and limits" />
          </MenuCard>
        </Section>
      )}
      <Section title="Community and rewards">
        <MenuCard>
          <MenuRow href="/app/referrals" icon={Users} label="Referrals" />
        </MenuCard>
      </Section>
      <Section title="Help">
        <MenuCard>
          <MenuRow href="/app/account/support" icon={LifeBuoy} label="Contact support" />
          <MenuRow href="/faq" icon={HelpCircle} label="FAQ" />
          <MenuRow href="/help" icon={BookOpen} label="Help centre" />
          {hide.includes("settings") && <MenuRow href="/app/account/responsible-play" icon={HeartHandshake} label="Responsible play" />}
          {isAdmin && <MenuRow href="/admin" icon={Wrench} label="Admin console" />}
        </MenuCard>
      </Section>
    </>
  );
}
