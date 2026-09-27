import { BadgeCheck, CalendarCheck, Gift, Lock, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Container, CtaBand, FeatureCard, SectionBlock, Steps } from "@/components/public/marketing";
import { Button } from "@/components/ui/button";

const GAMES = [
  {
    art: "/illustrations/box-hub.webp",
    title: "Mystery Box",
    body: "Nine treasure crates, one choice. Pick a crate and discover Credits, collection items, fragments, keys or Cash rewards.",
  },
  {
    art: "/illustrations/island-map.webp",
    title: "Mystery Map",
    body: "Explore Lost Island spot by spot. Unlock new regions and find the Temple hidden behind ancient requirements.",
  },
  {
    art: "/illustrations/vault-door.webp",
    title: "The Vault",
    body: "Gather keys, seal fragments and relics to open vaults filled with the island's rarest rewards.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b bg-[radial-gradient(ellipse_at_top_right,var(--brand-soft),transparent_60%)]">
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-primary">
              <Sparkles className="size-4" aria-hidden /> A reward adventure on Lost Island
            </p>
            <h1 className="mt-5 text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Explore. Discover. Collect. <span className="text-primary">Unlock.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Explore the island map, discover hidden treasures, fill your collection book and unlock the Ancient Vault. Something new every day.
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
            <div className="relative aspect-[3/4] overflow-hidden rounded-[2.5rem] border-8 border-foreground/90 shadow-lift">
              <Image src="/illustrations/island-map.webp" alt="Illustrated map of Lost Island" fill priority sizes="384px" className="object-cover" />
              <div aria-hidden className="art-scrim-b absolute inset-0" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/90 p-3 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Lost Island Relics</span>
                  <span className="text-sm font-bold text-gold-foreground">6 / 10</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-2 w-3/5 rounded-full bg-amber-500" />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <SectionBlock title="Three ways to play" description="Every game feeds into the same adventure: items, fragments and keys you find in one game help you in another.">
        <div className="grid gap-5 md:grid-cols-3">
          {GAMES.map((g) => (
            <div key={g.title} className="overflow-hidden rounded-3xl border bg-card shadow-card">
              <div className="relative h-44">
                <Image src={g.art} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
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
