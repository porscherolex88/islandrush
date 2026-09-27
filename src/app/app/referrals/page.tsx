import type { Metadata } from "next";
import { PageHeader, Panel, Section } from "@/components/app/mobile-header";
import { ReferralCard } from "@/components/app/referral-card";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatMYR } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";
import { formatDate, formatDateTime } from "@/lib/time";
import { isFeatureEnabled } from "@/server/services/config";
import { getReferralSummary } from "@/server/services/referrals";

export const metadata: Metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  const user = await requireUser();
  const [s, origin, enabled] = await Promise.all([getReferralSummary(user.id), siteUrl(), isFeatureEnabled("referrals")]);
  const link = `${origin}/register?ref=${s.code}`;
  const active = enabled && s.config.enabled;
  const levels = s.levels.filter((l) => l.active && l.level <= s.config.levels);

  return (
    <div>
      <PageHeader title="Referrals" subtitle="Invite friends and earn when they deposit" />
      <Section>
        {active ? (
          <ReferralCard code={s.code} link={link} />
        ) : (
          <EmptyState icon="🤝" title="Referrals are paused" description="The referral program is temporarily unavailable. Existing rewards are unaffected." />
        )}
      </Section>

      <Section>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Level 1", value: s.counts.l1 },
            { label: "Level 2", value: s.counts.l2 },
            { label: "Level 3", value: s.counts.l3 },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border bg-card p-3">
              <p className="font-heading text-2xl font-bold tabular">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Panel className="p-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="font-heading text-xl font-bold tabular">{formatMYR(s.totals.pending)}</p>
          </Panel>
          <Panel className="p-3">
            <p className="text-xs text-muted-foreground">Earned (settled)</p>
            <p className="font-heading text-xl font-bold text-success tabular">{formatMYR(s.totals.settled)}</p>
          </Panel>
        </div>
      </Section>

      <Section title="How you earn">
        <Panel className="space-y-3">
          <ol className="space-y-2">
            {levels.map((l) => (
              <li key={l.level} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <strong>Level {l.level}</strong>{" "}
                  <span className="text-muted-foreground">{l.level === 1 ? "friends you invite" : l.level === 2 ? "friends they invite" : "the next level"}</span>
                </span>
                <span className="font-semibold">{l.rewardKind === "PERCENT" ? `${Number(l.value)}% of first deposit` : `${formatMYR(l.value)} per friend`}</span>
              </li>
            ))}
          </ol>
          <ul className="list-disc space-y-1 border-t pt-3 pl-5 text-xs text-muted-foreground">
            <li>Rewards are earned when a referred friend makes their first qualifying deposit of {formatMYR(s.config.qualifyingDepositMin)} or more.</li>
            <li>Referral rewards are held as Pending for about {s.config.pendingHours} hours, then become Withdrawable.</li>
            <li>Self-referrals, duplicate accounts and shared payment details are not eligible and may be reversed.</li>
          </ul>
        </Panel>
      </Section>

      <Section title="Your friends">
        {s.directReferrals.length === 0 ? (
          <EmptyState icon="👋" title="No referrals yet" description="Share your code. Friends who join will appear here." />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {s.directReferrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(r.joined)}</p>
                </div>
                <StatusBadge status={r.qualified ? "COMPLETED" : "PENDING"} label={r.qualified ? "Qualified" : "Not yet deposited"} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {s.recentRewards.length > 0 && (
        <Section title="Referral rewards">
          <ul className="divide-y rounded-2xl border bg-card">
            {s.recentRewards.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium">Level {r.referralLevel} reward</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular">{formatMYR(r.amount)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
