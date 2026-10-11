import { ChevronRight, HandCoins, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import { Fragment } from "react";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { ReferralCard } from "@/components/app/referral-card";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { siteUrl } from "@/lib/site-url";
import { formatDate, formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/server/services/config";
import { getReferralSummary } from "@/server/services/referrals";

export const metadata: Metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  const fiat = await getFiatDisplay();
  const user = await requireUser();
  const [s, origin, enabled] = await Promise.all([getReferralSummary(user.id), siteUrl(), isFeatureEnabled("referrals")]);
  const link = `${origin}/register?ref=${s.code}`;
  const active = enabled && s.config.enabled;
  const levels = s.levels.filter((l) => l.active && l.level <= s.config.levels);
  const rewardText = (l: (typeof levels)[number]) => (l.rewardKind === "PERCENT" ? `${Number(l.value)}% of first deposit` : `${formatCash(l.value, { currency: fiat })} each`);
  const network = [
    { label: "Direct friends", hint: "People you invited", value: s.counts.l1 },
    { label: "Level 2", hint: "Friends they invited", value: s.counts.l2 },
    { label: "Level 3", hint: "The next circle", value: s.counts.l3 },
  ].slice(0, Math.max(1, s.config.levels));

  return (
    <div>
      <InnerPageHeader title="Referrals" subtitle="Invite friends, earn rewards" />
      <Section>
        {active ? (
          <ReferralCard code={s.code} link={link} />
        ) : (
          <EmptyState icon={<Users className="size-8 text-primary" />} title="Invites are paused" description="The invite program is temporarily unavailable. Rewards you already earned are not affected." />
        )}
      </Section>

      <Section title="Your network">
        <div className={cn("grid gap-2 text-center", network.length === 3 ? "grid-cols-3" : network.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {network.map((c) => (
            <div key={c.label} className="rounded-2xl border bg-card p-3">
              <p className="font-heading text-3xl font-extrabold tabular">{c.value}</p>
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.hint}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Your earnings">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="font-heading text-2xl font-extrabold tabular">{formatCash(s.totals.pending, { currency: fiat })}</p>
            <p className="text-xs text-muted-foreground">Under review</p>
          </div>
          <div className="rounded-2xl bg-success-soft p-4">
            <p className="text-sm text-muted-foreground">Earned</p>
            <p className="font-heading text-2xl font-extrabold text-success tabular">{formatCash(s.totals.settled, { currency: fiat })}</p>
            <p className="text-xs text-muted-foreground">Now withdrawable</p>
          </div>
        </div>
      </Section>

      <Section title="How it works">
        <div className="rounded-2xl border bg-card p-4">
          <ol className="flex items-start justify-between" aria-label="Invite levels">
            <li className="flex w-16 flex-col items-center gap-1 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                <UserRound className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-bold">You</span>
            </li>
            {levels.map((l) => (
              <Fragment key={l.level}>
                <ChevronRight className="mt-4 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <li className="flex w-16 flex-col items-center gap-1 text-center">
                  <span className="grid size-12 place-items-center rounded-full bg-gold-soft text-gold-foreground">
                    <UserRound className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-bold">Friend</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">{rewardText(l)}</span>
                </li>
              </Fragment>
            ))}
          </ol>
          <ul className="mt-4 space-y-1.5 border-t pt-3 text-sm text-muted-foreground">
            <li>1. Share your link with a friend.</li>
            <li>2. They sign up and make a first deposit of {formatCash(s.config.qualifyingDepositMin, { currency: fiat })} or more.</li>
            <li>3. Your reward waits in Pending for about {s.config.pendingHours} hours, then becomes Withdrawable.</li>
          </ul>
        </div>
      </Section>

      <Section title="Your friends">
        {s.directReferrals.length === 0 ? (
          <EmptyState icon={<HandCoins className="size-8 text-primary" />} title="No friends yet" description="Share your link. Friends who join will appear here." />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {s.directReferrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-3.5 text-sm">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(r.joined)}</p>
                </div>
                <StatusBadge status={r.qualified ? "COMPLETED" : "PENDING"} label={r.qualified ? "Deposited" : "Not deposited yet"} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {s.recentRewards.length > 0 && (
        <Section title="Invite rewards">
          <ul className="divide-y rounded-2xl border bg-card">
            {s.recentRewards.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-3.5 text-sm">
                <div>
                  <p className="font-semibold">{r.referralLevel === 1 ? "Direct friend" : `Level ${r.referralLevel} friend`}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular">{formatCash(r.amount, { currency: fiat })}</p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Rules">
        <ul className="list-disc space-y-1.5 rounded-2xl bg-surface p-4 pl-8 text-sm text-muted-foreground">
          <li>Rewards count only when a friend makes their first qualifying deposit.</li>
          <li>Inviting yourself, duplicate accounts and shared bank details are not allowed. Rewards from these may be reversed.</li>
          <li>Rewards are reviewed before they become Withdrawable.</li>
        </ul>
      </Section>
    </div>
  );
}
