import type { Metadata } from "next";
import { CtaBand, FeatureCard, PageHero, SectionBlock } from "@/components/public/marketing";
import { formatMYR } from "@/lib/money";
import { publicRewardFacts } from "@/server/queries/public";

export const metadata: Metadata = { title: "Rewards", description: "Credits, collection items, keys, Special Items and Cash rewards." };
export const revalidate = 300;

export default async function RewardsPage() {
  const { levels, rewards, withdrawal } = await publicRewardFacts();
  return (
    <>
      <PageHero eyebrow="Rewards" title="What you can win" description="Every box, tile and vault can reveal something useful. Some rewards help you play, others you can withdraw." />
      <SectionBlock>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard emoji="🪙" title="Credits">
            Bonus Credits go straight to your balance so you can keep playing.
          </FeatureCard>
          <FeatureCard emoji="🏺" title="Collection items">
            Relics, shells and artifacts that fill collections. Complete a collection for a bonus reward.
          </FeatureCard>
          <FeatureCard emoji="🧩" title="Fragments">
            Pieces of something bigger. Five Ancient Map Fragments make the Ancient Map.
          </FeatureCard>
          <FeatureCard emoji="🔑" title="Keys">
            Open Special Areas on the map and unlock vaults.
          </FeatureCard>
          <FeatureCard emoji="💎" title="Special Items">
            Rare finds with a special purpose, like the Ancient Map or Temple Key.
          </FeatureCard>
          <FeatureCard emoji="💵" title="Cash rewards">
            Real Cash rewards that settle into your withdrawable balance after {rewards.pendingHours} hours.
          </FeatureCard>
        </div>
      </SectionBlock>
      <SectionBlock title="Withdrawing rewards" className="bg-surface">
        <div className="mx-auto grid max-w-3xl gap-3 text-sm">
          {[
            `Cash rewards start as Pending and settle after ${rewards.pendingHours} hours.`,
            `Withdraw from ${formatMYR(withdrawal.min)} up to ${formatMYR(withdrawal.maxPerRequest)} per request, to a bank account in your name.`,
            "Requests go through review, approval and payout. You can follow every step in your wallet.",
            "Rewards obtained through fraud or abuse may be held or reversed.",
          ].map((t) => (
            <p key={t} className="rounded-2xl border bg-card p-4">
              {t}
            </p>
          ))}
        </div>
      </SectionBlock>
      {levels.length > 0 && (
        <SectionBlock title="Deposit levels" description="Based on your total approved deposits. Separate from XP levels.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {levels.map((l) => (
              <div key={l.name} className="rounded-3xl border bg-card p-5" style={{ borderTopColor: l.color, borderTopWidth: 4 }}>
                <p className="font-heading text-lg font-bold">{l.name}</p>
                <p className="text-sm text-muted-foreground">From {formatMYR(l.threshold)}</p>
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
