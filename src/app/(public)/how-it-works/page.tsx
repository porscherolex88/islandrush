import { Banknote, CircleCheck, Clock, Coins, Gem, Landmark, Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand, FeatureCard, PageHero, SectionBlock, Steps } from "@/components/public/marketing";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { getConfig } from "@/server/services/config";

export const metadata: Metadata = { title: "How it works", description: "Deposit, convert to Credits, play three games and withdraw your rewards." };
export const revalidate = 300;

export default async function HowItWorksPage() {
  const fiat = await getFiatDisplay();
  const conversion = await getConfig("conversion");
  return (
    <>
      <PageHero eyebrow="How it works" title="From first spin to first withdrawal" description="Everything you need to know about Cash, Credits, games and rewards on LootBox." art="/illustrations/3d/coins.webp" />
      <SectionBlock eyebrow="Getting started" title="Four steps to your first reward">
        <Steps
          steps={[
            { title: "Sign up", body: "Create a free account. Your daily check-in, spin and missions are ready right away." },
            { title: "Deposit Cash", body: "Make a manual bank transfer and submit the reference. Our team verifies it, usually within 30 minutes." },
            { title: "Convert to Credits", body: `Credits power the games. ${formatCash(conversion.cash, { currency: fiat })} = ${formatCredits(conversion.credits)} Credits.` },
            { title: "Play, collect, withdraw", body: "Rewards land in your wallet. Cash rewards settle, then you can withdraw to your bank." },
          ]}
        />
      </SectionBlock>
      <SectionBlock eyebrow="Wallet" title="Your wallet, explained" className="bg-surface">
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
          <FeatureCard icon={Banknote} title="Cash">
            Money you&apos;ve deposited. Convert it into Credits whenever you want to play.
          </FeatureCard>
          <FeatureCard icon={Coins} title="Credits">
            Used to open boxes and explore. Every Credit price also shows its cash value in your currency.
          </FeatureCard>
          <FeatureCard icon={Clock} title="Pending rewards">
            Cash rewards you&apos;ve won that are going through the settlement period.
          </FeatureCard>
          <FeatureCard icon={CircleCheck} title="Withdrawable">
            Settled rewards ready to be sent to your bank account.
          </FeatureCard>
          <FeatureCard icon={Landmark} title="Withdrawal pending">
            Amounts in withdrawal requests that are being reviewed or paid out.
          </FeatureCard>
        </div>
      </SectionBlock>
      <SectionBlock eyebrow="Progress" title="Two ways to level up">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <FeatureCard icon={MapIcon} title="Adventure levels">
            Open Mystery Boxes to collect Loot, reach checkpoints and finish each map. Every map you complete moves you up an Adventure Level, up to 10.
          </FeatureCard>
          <FeatureCard icon={Gem} title="Deposit levels">
            Deposit Levels are based on your total approved deposits and come with their own benefits.
          </FeatureCard>
        </div>
      </SectionBlock>
      <CtaBand />
    </>
  );
}
