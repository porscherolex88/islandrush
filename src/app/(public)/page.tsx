import { BadgeCheck, CalendarCheck, Gift, Lock, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { Container, CtaBand, FeatureCard, SectionBlock, Steps } from "@/components/public/marketing";
import { Button } from "@/components/ui/button";

const GAMES = [
  {
    emoji: "🎁",
    title: "Mystery Box",
    body: "Nine boxes, one choice. Pick a box and reveal Credits, collection items, fragments, keys or Cash rewards.",
    tone: "from-violet-500 to-fuchsia-500",
  },
  {
    emoji: "🗺️",
    title: "Mystery Map",
    body: "Explore Lost Island tile by tile. Unlock new areas and discover Special Areas hidden behind ancient requirements.",
    tone: "from-emerald-500 to-teal-500",
  },
  {
    emoji: "🏛️",
    title: "The Vault",
    body: "Gather keys, seal fragments and relics to open vaults filled with the island's rarest rewards.",
    tone: "from-amber-500 to-orange-500",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b bg-[radial-gradient(ellipse_at_top_right,var(--brand-soft),transparent_60%)]">
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-primary">
              <Sparkles className="size-4" aria-hidden /> Something new every day
            </p>
            <h1 className="mt-5 text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Open. Explore. <span className="text-primary">Unlock.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              LootBox is a rewards adventure on Lost Island. Open Mystery Boxes, explore the map, complete collections and unlock the Ancient Vault.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="xl">
                <Link href="/register">Get started free</Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="/games">See the games</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free daily spin and check-in. 18+ only.</p>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-[2.5rem] border-8 border-foreground/90 bg-background p-4 shadow-lift">
              <div className="rounded-3xl bg-[linear-gradient(135deg,oklch(0.5_0.22_285),oklch(0.38_0.17_295))] p-4 text-white">
                <p className="text-xs text-white/70">Good morning, explorer</p>
                <p className="font-heading text-xl font-bold">Day 7 streak 🔥</p>
                <div className="mt-3 h-2 rounded-full bg-white/20">
                  <div className="h-2 w-2/3 rounded-full bg-gold" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["🎁", "❔", "🎁", "❔", "✨", "❔", "🎁", "❔", "🎁"].map((e, i) => (
                  <div key={i} className="grid aspect-square place-items-center rounded-2xl bg-brand-soft text-2xl">
                    {e}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-gold-soft p-3">
                <span className="text-sm font-semibold">Ancient Map Fragment</span>
                <span className="text-sm font-bold text-gold-foreground">3 / 5</span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <SectionBlock title="Three ways to play" description="Every game feeds into the same adventure: items, fragments and keys you find in one game help you in another.">
        <div className="grid gap-5 md:grid-cols-3">
          {GAMES.map((g) => (
            <div key={g.title} className="overflow-hidden rounded-3xl border bg-card shadow-card">
              <div className={`grid h-36 place-items-center bg-gradient-to-br ${g.tone} text-6xl`}>
                <span aria-hidden>{g.emoji}</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold">{g.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{g.body}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionBlock>

      <SectionBlock title="A reason to come back every day" className="bg-surface">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={CalendarCheck} title="Daily check-in">
            Claim your login reward and build a streak. Milestones at 3, 7, 14 and 30 days.
          </FeatureCard>
          <FeatureCard icon={Gift} title="Daily spin">
            One free spin every day, with a bonus spin for long streaks.
          </FeatureCard>
          <FeatureCard icon={BadgeCheck} title="Three missions">
            Fresh missions daily. Finish all three for a bonus reward.
          </FeatureCard>
          <FeatureCard icon={Sparkles} title="Mystery events">
            A surprise event on the island each day, plus free map discoveries.
          </FeatureCard>
        </div>
      </SectionBlock>

      <SectionBlock title="How it works">
        <Steps
          steps={[
            { title: "Create an account", body: "Sign up free and claim your daily check-in and spin." },
            { title: "Add Cash and get Credits", body: "Deposit by bank transfer, then convert Cash into Credits to play." },
            { title: "Play and collect", body: "Open boxes, explore the map and fill collections for bonus rewards." },
            { title: "Withdraw rewards", body: "Cash rewards settle into your withdrawable balance, ready to cash out." },
          ]}
        />
      </SectionBlock>

      <SectionBlock title="Built to be fair and transparent" className="bg-surface">
        <div className="grid gap-5 md:grid-cols-4">
          <FeatureCard icon={ShieldCheck} title="Server-decided results">
            Outcomes are generated on our servers with a secure random number generator, never in your browser.
          </FeatureCard>
          <FeatureCard icon={Lock} title="Published odds">
            Every Mystery Box shows its possible rewards and their chances before you play.
          </FeatureCard>
          <FeatureCard icon={Wallet} title="Clear wallet">
            Cash, Credits, pending and withdrawable balances, with a full transaction history.
          </FeatureCard>
          <FeatureCard icon={Users} title="Responsible play">
            Set daily spending limits or take a break at any time from your account.
          </FeatureCard>
        </div>
      </SectionBlock>

      <CtaBand />
    </>
  );
}
