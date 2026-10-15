import { Banknote, CircleCheck, Clock, Coins, Gem, Landmark, Map as MapIcon, Puzzle, ShoppingBag, Target } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand, FeatureCard, PageHero, SectionBlock, Steps } from "@/components/public/marketing";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { FREE_GAME_SOCIAL, freeGameSocialMetadata } from "@/lib/seo";
import { getConfig } from "@/server/services/config";

export const metadata: Metadata = freeGameSocialMetadata(FREE_GAME_SOCIAL.howItWorks);
export const revalidate = 300;

export default async function HowItWorksPage() {
  const fiat = await getFiatDisplay();
  const conversion = await getConfig("conversion");
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="How LootBox Works: 10 Islands, Loot and Puzzle Prizes"
        description="Open Mystery Boxes for Loot, unlock checkpoints across ten islands, finish puzzles for prizes, and keep everything organised in Collections."
        art="/illustrations/3d/coins.webp"
      />
      <SectionBlock eyebrow="Getting started" title="Five steps on LootBox">
        <Steps
          steps={[
            {
              title: "Daily check-in and spin",
              body: "Claim your daily check-in and spin. Missions refresh every day and pay a bonus when you finish them.",
            },
            {
              title: "Open Mystery Boxes",
              body: "Open Mystery Boxes to collect Loot. Loot stays in your collection and adds up over time.",
            },
            {
              title: "Unlock checkpoints",
              body: "Fill each trail's chest to unlock checkpoints across the 10 islands. Checkpoints open in order.",
            },
            {
              title: "Big Box and puzzles",
              body: "Open each island's Big Box for Puzzle pieces, finish the puzzle, and spin the prize wheel.",
            },
            {
              title: "Market and Collections",
              body: "Trade items on the Market and track everything you have collected in Collections.",
            },
          ]}
        />
      </SectionBlock>
      <SectionBlock eyebrow="Wallet" title="Cash and Credits" className="bg-surface">
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
          <FeatureCard icon={Banknote} title="Cash">
            Money in your Cash wallet. Convert it into Credits when you want to open boxes or trade on the Market. Rate: {formatCash(conversion.cash, { currency: fiat })} ={" "}
            {formatCredits(conversion.credits)} Credits.
          </FeatureCard>
          <FeatureCard icon={Coins} title="Credits">
            What you play with. Use Credits to open Mystery Boxes and buy items on the Market.
          </FeatureCard>
          <FeatureCard icon={Clock} title="Pending rewards">
            Cash rewards going through the settlement period before they become withdrawable.
          </FeatureCard>
          <FeatureCard icon={CircleCheck} title="Withdrawable">
            Settled rewards ready to send to a bank account in your name.
          </FeatureCard>
          <FeatureCard icon={Landmark} title="Withdrawal pending">
            Amounts in withdrawal requests that are being reviewed or paid out.
          </FeatureCard>
        </div>
      </SectionBlock>
      <SectionBlock eyebrow="The loop" title="What each part is for">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Gem} title="Loot">
            Collectible finds from Mystery Boxes. Loot stays in your collection and unlocks checkpoints when you have enough for that island.
          </FeatureCard>
          <FeatureCard icon={MapIcon} title="Checkpoints">
            Each island has a trail of checkpoints leading to a chest. Fill the chest with Loot to open the next stop.
          </FeatureCard>
          <FeatureCard icon={Puzzle} title="Puzzle pieces">
            Come from that island&apos;s Big Box only. Complete the puzzle to spin the prize wheel. Prizes are subject to availability and our Terms.
          </FeatureCard>
          <FeatureCard icon={ShoppingBag} title="Market">
            Sell items to other players and buy theirs with Credits. You set the price within the allowed range.
          </FeatureCard>
          <FeatureCard icon={Target} title="Collections">
            See everything you have collected and track your progress across the adventure.
          </FeatureCard>
          <FeatureCard icon={Coins} title="Daily rewards">
            A free daily spin, a check-in that builds your streak, and missions that pay a bonus when completed.
          </FeatureCard>
        </div>
      </SectionBlock>
      <CtaBand />
    </>
  );
}
