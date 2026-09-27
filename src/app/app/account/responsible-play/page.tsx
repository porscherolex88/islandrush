import type { Metadata } from "next";
import Link from "next/link";
import { PlayLimitsForm } from "@/components/app/account-forms";
import { PageHeader, Panel, Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Responsible play" };

export default async function ResponsiblePlayPage() {
  const user = await requireUser();
  const until = user.playLimits.selfExcludedUntil ? new Date(user.playLimits.selfExcludedUntil) : null;
  const onBreak = Boolean(until && until > new Date());
  return (
    <div>
      <PageHeader title="Responsible play" subtitle="Tools to keep LootBox fun" back="/app/account" />
      <Section>
        <Panel className="space-y-1 bg-brand-soft/60">
          <p className="text-sm font-semibold">Your current settings</p>
          <p className="text-sm text-muted-foreground">
            Daily limit: {user.playLimits.dailyCreditLimit ? `${formatCredits(user.playLimits.dailyCreditLimit)} Credits` : "None"}
          </p>
          <p className="text-sm text-muted-foreground">Play break: {onBreak && until ? `Active until ${formatDateTime(until)}` : "None"}</p>
        </Panel>
      </Section>
      <Section>
        <PlayLimitsForm dailyCreditLimit={user.playLimits.dailyCreditLimit} onBreak={onBreak} />
      </Section>
      <Section>
        <p className="text-sm text-muted-foreground">
          Play for fun, only with money you can afford. Read our{" "}
          <Link href="/responsible-play" className="font-semibold text-primary underline">
            responsible play guide
          </Link>{" "}
          or{" "}
          <Link href="/app/account/support" className="font-semibold text-primary underline">
            talk to support
          </Link>{" "}
          if you need a longer break or account closure.
        </p>
      </Section>
    </div>
  );
}
