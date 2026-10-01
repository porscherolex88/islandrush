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
      <PageHero eyebrow="How it works" title="From first spin to first withdrawal" description="Everything you need to know about Cash, Credits, games and rewards on LootBox." />
      <SectionBlock title="Getting started">
        <Steps
          steps={[
            { title: "Sign up", body: "Create a free account. Your daily check-in, spin and missions are ready right away." },
            { title: "Deposit Cash", body: "Make a manual bank transfer and submit the reference. Our team verifies it, usually within 30 minutes." },
            { title: "Convert to Credits", body: `Credits power the games. ${formatCash(conversion.cash, { currency: fiat })} = ${formatCredits(conversion.credits)} Credits.` },
            { title: "Play, collect, withdraw", body: "Rewards land in your wallet. Cash rewards settle, then you can withdraw to your bank." },
          ]}
        />
      </SectionBlock>
      <SectionBlock title="Your wallet, explained" className="bg-surface">
        <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-5">
          <FeatureCard emoji="💵" title="Cash">
            Money you&apos;ve deposited. Convert it into Credits whenever you want to play.
          </FeatureCard>
          <FeatureCard emoji="🪙" title="Credits">
            Used to open boxes and explore. Every Credit price also shows its cash value in your currency.
          </FeatureCard>
          <FeatureCard emoji="⏳" title="Pending rewards">
            Cash rewards you&apos;ve won that are going through the settlement period.
          </FeatureCard>
          <FeatureCard emoji="✅" title="Withdrawable">
            Settled rewards ready to be sent to your bank account.
          </FeatureCard>
          <FeatureCard emoji="🏦" title="Withdrawal pending">
            Amounts in withdrawal requests that are being reviewed or paid out.
          </FeatureCard>
        </div>
      </SectionBlock>
      <SectionBlock title="Two ways to level up">
        <div className="grid gap-5 md:grid-cols-2">
          <FeatureCard emoji="⭐" title="XP levels">
            Earn XP by playing, completing missions, discovering tiles and finishing collections. Higher levels unlock badges and bragging rights.
          </FeatureCard>
          <FeatureCard emoji="💎" title="Deposit levels">
            Separate from XP, Deposit Levels are based on your total approved deposits and come with their own benefits.
          </FeatureCard>
        </div>
      </SectionBlock>
      <CtaBand />
    </>
  );
}
