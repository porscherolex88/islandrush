import { Box, CalendarCheck, Disc3, HandCoins, ListChecks, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import { type EarnWay, EarnMore } from "@/components/app/earn-more";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { ReferralCard } from "@/components/app/referral-card";
import { ReferralHero } from "@/components/app/referral-hero";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { siteUrl } from "@/lib/site-url";
import { formatDate, formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/server/services/config";
import { getDailyState } from "@/server/services/daily";
import { getReferralSummary } from "@/server/services/referrals";

export const metadata: Metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  const fiat = await getFiatDisplay();
  const user = await requireUser();
  const [s, origin, enabled, daily] = await Promise.all([getReferralSummary(user.id), siteUrl(), isFeatureEnabled("referrals"), getDailyState(user.id)]);
  const cash = (v: Parameters<typeof formatCash>[0]) => formatCash(v, { currency: fiat });
  const link = `${origin}/register?ref=${s.code}`;
  const active = enabled && s.config.enabled;
  const levels = s.levels.filter((l) => l.active && l.level <= s.config.levels);
  const rewardText = (l: (typeof levels)[number]) => (l.rewardKind === "PERCENT" ? `${Number(l.value)}% of first deposit` : `${cash(l.value)} each`);
  const direct = levels.find((l) => l.level === 1);
  const headline = !direct
    ? "Invite friends, explore together"
    : direct.rewardKind === "PERCENT"
      ? `Earn ${Number(direct.value)}% of every friend's first deposit`
      : `Earn ${cash(direct.value)} for every friend who deposits`;
  const network = [
    { label: "Direct friends", hint: "People you invited", value: s.counts.l1 },
    { label: "Level 2", hint: "Friends they invited", value: s.counts.l2 },
    { label: "Level 3", hint: "The next circle", value: s.counts.l3 },
  ]
    .slice(0, Math.max(1, s.config.levels))
    .map((c, i) => ({ ...c, reward: levels.find((l) => l.level === i + 1) }));

  const streak = daily.streak.current;
  const ways: EarnWay[] = [
    {
      href: "/daily",
      icon: CalendarCheck,
      title: "Daily check-in",
      description:
        streak > 0
          ? `Day ${streak} streak.${daily.nextMilestone ? ` ${daily.nextMilestone.title} in ${daily.nextMilestone.inDays} day${daily.nextMilestone.inDays === 1 ? "" : "s"}.` : ""}`
          : "Check in every day to build a streak and unlock milestone rewards.",
      done: daily.loginClaimed,
    },
    ...(daily.spinAvailable ? [{ href: "/daily#spin", icon: Disc3, title: "Daily Spin", description: "One free spin every day.", done: Boolean(daily.spin) }] : []),
    ...(daily.missions.length
      ? [
          {
            href: "/daily#missions",
            icon: ListChecks,
            title: "Daily Missions",
            description: `${daily.missionsDone} of ${daily.missions.length} done. Finish all for a bonus reward.`,
            done: daily.missionsDone >= daily.missions.length,
          },
        ]
      : []),
    ...(daily.event ? [{ href: "/daily#event", icon: Sparkles, title: "Daily Mystery", description: daily.event.title, done: Boolean(daily.eventClaim) }] : []),
    { href: "/play/mystery-box", icon: Box, title: "Mystery Box", description: "Open a box for Loot, Credits and collectible items." },
  ];

  return (
    <div>
      <InnerPageHeader title="Referrals" subtitle="Invite friends, earn rewards" />
      <Section>
        <ReferralHero
          total={cash(s.totals.all)}
          stats={[
            { label: "Withdrawable", value: cash(s.totals.settled) },
            { label: "Pending", value: cash(s.totals.pending) },
            { label: "Friends", value: String(s.counts.l1) },
          ]}
        />
      </Section>

      <Section>
        {active ? (
          <ReferralCard
            code={s.code}
            link={link}
            headline={headline}
            steps={[
              "Share your link or code with a friend.",
              `They sign up and make a first deposit of ${cash(s.config.qualifyingDepositMin)} or more.`,
              `Your reward waits in Pending for about ${s.config.pendingHours} hours, then becomes withdrawable.`,
            ]}
          />
        ) : (
          <EmptyState icon={<Users className="size-8 text-primary" />} title="Invites are paused" description="The invite program is temporarily unavailable. Rewards you already earned are not affected." />
        )}
      </Section>

      <Section>
        <EarnMore ways={ways} />
      </Section>

      <Section title="Your network">
        <div className={cn("grid gap-2 text-center", network.length === 3 ? "grid-cols-3" : network.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {network.map((c) => (
            <div key={c.label} className="rounded-2xl border bg-card p-3">
              <p className="font-heading text-3xl font-extrabold tabular">{c.value}</p>
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.hint}</p>
              {c.reward && <p className="mt-1.5 text-[11px] leading-tight font-semibold text-primary">{rewardText(c.reward)}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Your friends" id="friends" className="scroll-mt-20">
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
                <StatusBadge status={r.qualified ? "COMPLETED" : "PENDING"} tone={r.qualified ? "brand" : "neutral"} label={r.qualified ? "Deposited" : "Not deposited yet"} />
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
                  <StatusBadge status={r.status} tone={r.status === "SETTLED" ? "brand" : r.status === "REVERSED" ? "danger" : "neutral"} />
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
