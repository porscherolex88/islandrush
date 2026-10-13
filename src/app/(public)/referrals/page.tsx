import type { Metadata } from "next";
import { CtaBand, PageHero, SectionBlock, Steps } from "@/components/public/marketing";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { publicReferralFacts } from "@/server/queries/public";

export const metadata: Metadata = { title: "Referrals", description: "Invite friends and earn referral rewards up to three levels." };
export const revalidate = 300;

export default async function ReferralsInfoPage() {
  const fiat = await getFiatDisplay();
  const { levels, referral } = await publicReferralFacts();
  return (
    <>
      <PageHero eyebrow="Referrals" title="Bring friends on the adventure" description="Share your code. When friends join and make a qualifying deposit, you earn rewards." art="/illustrations/3d/prize-gift.webp" />
      <SectionBlock eyebrow="Step by step" title="How referrals work">
        <Steps
          steps={[
            { title: "Share your code", body: "Find your personal referral link in the app under Referrals." },
            { title: "Friends sign up", body: "They register with your link or enter your code during sign-up." },
            { title: "They make a deposit", body: `A first deposit of at least ${formatCash(referral.qualifyingDepositMin, { currency: fiat })} qualifies.` },
            { title: "You earn", body: `Rewards are pending for ${referral.pendingHours} hours, then become withdrawable.` },
          ]}
        />
      </SectionBlock>
      {levels.length > 0 && (
        <SectionBlock eyebrow="Rewards" title="Reward levels" className="bg-surface">
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {levels.map((l) => (
              <div key={l.level} className="rounded-3xl border bg-card p-6 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Level {l.level}</p>
                <p className="mt-2 font-heading text-3xl font-bold text-primary">{l.rewardKind === "PERCENT" ? `${Number(l.value)}%` : formatCash(l.value, { currency: fiat })}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {l.level === 1 ? "Friends you invite directly" : l.level === 2 ? "Friends invited by your friends" : "The next level down"}
                </p>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}
      <SectionBlock eyebrow="Fair play" title="Fair play rules">
        <ul className="max-w-2xl list-disc space-y-2 rounded-3xl border bg-card p-5 pl-10 text-sm text-muted-foreground">
          <li>Self-referrals, duplicate accounts and shared devices or payment details are not allowed.</li>
          <li>Referral rewards are reviewed before they settle and may be reversed if abuse is detected.</li>
          <li>Rewards are based on qualifying first deposits, not on how much your friends play.</li>
        </ul>
      </SectionBlock>
      <CtaBand title="Start inviting friends" description="Create an account to get your personal referral code." />
    </>
  );
}
