import { Banknote, CalendarCheck, Coins, Gem, Puzzle, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand, FeatureCard, PageHero, SectionBlock } from "@/components/public/marketing";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { publicRewardFacts } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "LootBox Rewards: Daily Spin, Check-ins, Missions and Prizes",
  description: "Daily spin, check-ins, missions, Loot, Puzzle pieces, island prizes, and Cash rewards on LootBox.",
};
export const revalidate = 300;

export default async function RewardsPage() {
  const fiat = await getFiatDisplay();
  const { levels, rewards, withdrawal } = await publicRewardFacts();
  return (
    <>
      <PageHero
        eyebrow="Rewards"
        title="LootBox Rewards: Daily Spin, Check-ins, Missions and Prizes"
        description="Claim free daily rewards, collect Loot from Mystery Boxes, finish island puzzles, and track Cash rewards in your wallet."
        art="/illustrations/3d/chest-burst.webp"
      />
      <SectionBlock eyebrow="Every day" title="Free rewards you can claim">
        <div className="grid gap-5 sm:grid-cols-3">
          <FeatureCard icon={CalendarCheck} title="Daily check-in">
            Check in each day to keep your streak going and collect the check-in reward.
          </FeatureCard>
          <FeatureCard icon={Coins} title="Daily spin">
            One free spin every day. A longer streak can unlock a boosted spin pool.
          </FeatureCard>
          <FeatureCard icon={Target} title="Daily missions">
            Three missions refresh every day. Finish all three for a bonus reward.
          </FeatureCard>
        </div>
      </SectionBlock>
      <SectionBlock eyebrow="On the islands" title="Loot, Puzzle pieces and prizes" className="bg-surface">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Gem} title="Loot">
            Collectible items from Mystery Boxes, such as shells, pearls, relics and crowns. Loot stays in your collection and unlocks checkpoints when you have enough for that island.
          </FeatureCard>
          <FeatureCard icon={Puzzle} title="Puzzle pieces">
            Each island&apos;s Big Box drops pieces for that island&apos;s puzzle only. Pieces cannot move between islands. Finish the puzzle to spin the prize wheel.
          </FeatureCard>
          <FeatureCard icon={Trophy} title="Island prizes">
            Completing a puzzle unlocks that island&apos;s prize. Higher islands have higher prize tiers. Prizes are subject to availability and our Terms.
          </FeatureCard>
          <FeatureCard icon={Coins} title="Credits">
            Bonus Credits go straight to your Credits wallet so you can open more boxes or buy on the Market.
          </FeatureCard>
          <FeatureCard icon={Banknote} title="Cash rewards">
            Cash rewards settle into your withdrawable balance after {rewards.pendingHours} hours, subject to eligibility checks in our Terms.
          </FeatureCard>
        </div>
        <p className="mt-6 text-center text-sm font-semibold text-muted-foreground">Prizes are subject to availability and our Terms.</p>
      </SectionBlock>
      <SectionBlock eyebrow="Cash out" title="Withdrawing rewards">
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
        <SectionBlock eyebrow="Levels" title="Deposit levels" description="Based on your total approved deposits." className="bg-surface">
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
