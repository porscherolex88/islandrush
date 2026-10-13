import { Banknote, Coins, Gem, Puzzle, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand, FeatureCard, PageHero, SectionBlock } from "@/components/public/marketing";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { publicRewardFacts } from "@/server/queries/public";

export const metadata: Metadata = { title: "Rewards", description: "Credits, Loot, puzzle pieces, prizes and Cash rewards." };
export const revalidate = 300;

export default async function RewardsPage() {
  const fiat = await getFiatDisplay();
  const { levels, rewards, withdrawal } = await publicRewardFacts();
  return (
    <>
      <PageHero eyebrow="Rewards" title="What you can win" description="Every box, checkpoint and puzzle can reveal something useful. Some rewards help you play, others you can withdraw." art="/illustrations/3d/chest-burst.webp" />
      <SectionBlock eyebrow="Reward types" title="Five ways to be rewarded">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Coins} title="Credits">
            Bonus Credits go straight to your balance so you can keep playing.
          </FeatureCard>
          <FeatureCard icon={Gem} title="Loot">
            Map-specific finds from every Mystery Box. Loot is never used up: it keeps counting toward that map&apos;s checkpoints.
          </FeatureCard>
          <FeatureCard icon={Puzzle} title="Puzzle pieces">
            Found in the Big Mystery Box at the end of each map. Complete a puzzle to reach its prize unlock.
          </FeatureCard>
          <FeatureCard icon={Trophy} title="Prizes">
            Each Adventure Level has its own prize tier. Higher levels lead to bigger prizes.
          </FeatureCard>
          <FeatureCard icon={Banknote} title="Cash rewards">
            Real Cash rewards that settle into your withdrawable balance after {rewards.pendingHours} hours.
          </FeatureCard>
        </div>
      </SectionBlock>
      <SectionBlock eyebrow="Cash out" title="Withdrawing rewards" className="bg-surface">
        <ol className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            `Cash rewards start as Pending and settle after ${rewards.pendingHours} hours.`,
            `Withdraw from ${formatCash(withdrawal.min, { currency: fiat })} up to ${formatCash(withdrawal.maxPerRequest, { currency: fiat })} per request, to a bank account in your name.`,
            "Requests go through review, approval and payout. You can follow every step in your wallet.",
            "Rewards obtained through fraud or abuse may be held or reversed.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3 rounded-3xl border bg-card p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold font-heading text-sm font-bold text-[var(--gold-ink)]">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </SectionBlock>
      {levels.length > 0 && (
        <SectionBlock eyebrow="Levels" title="Deposit levels" description="Based on your total approved deposits.">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {levels.map((l) => (
              <div key={l.name} className="rounded-3xl border bg-card p-4 sm:p-5" style={{ borderTopColor: l.color, borderTopWidth: 4 }}>
                <p className="font-heading text-lg font-bold">{l.name}</p>
                <p className="text-sm text-muted-foreground">From {formatCash(l.threshold, { currency: fiat })}</p>
                {l.benefits.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-sm">
                    {l.benefits.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </SectionBlock>
      )}
      <CtaBand />
    </>
  );
}
