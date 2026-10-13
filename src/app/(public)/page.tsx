import { Banknote, Gift, Lock, ShieldCheck, Sparkles, UserPlus, Users, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Container, CtaBand, LandingButton, SectionHeading } from "@/components/public/marketing";
import { DailyTeaser } from "@/components/public/landing/daily-teaser";
import { Hero3D } from "@/components/public/landing/hero-3d";
import { LevelCarousel } from "@/components/public/landing/level-carousel";
import { LiveTicker } from "@/components/public/landing/live-ticker";
import { LoopJourney } from "@/components/public/landing/loop-journey";
import { MarketShowcase } from "@/components/public/landing/market-showcase";
import { OddsBar } from "@/components/public/landing/odds-bar";
import { PromoPopup } from "@/components/public/landing/promo-popup";
import { PromoTicker } from "@/components/public/landing/promo-ticker";
import { StatCounter } from "@/components/public/landing/stat-counter";
import { getAuthSession } from "@/lib/auth/session";
import { activeBanners } from "@/server/queries/banners";
import { landingMaps, landingStats, MIN_ACTIVITY, recentActivity } from "@/server/queries/landing";

const MONEY_STEPS = [
  { icon: UserPlus, title: "Sign up free", body: "Claim your daily check-in and spin straight away." },
  { icon: Banknote, title: "Add Cash", body: "Deposit by bank transfer. Approved deposits land in your Cash wallet." },
  { icon: Wallet, title: "Convert to Credits", body: "Credits open Mystery Boxes and buy items on the Market." },
  { icon: Lock, title: "Withdraw rewards", body: "Cash rewards settle into your withdrawable balance, ready to cash out." },
];

const TRUST = [
  { icon: ShieldCheck, title: "Server-decided results", body: "Every outcome is drawn on our servers with a secure random number generator, never in your browser." },
  { icon: Wallet, title: "A clear wallet", body: "Cash, Credits, pending and withdrawable balances, with a full transaction history." },
  { icon: Users, title: "Play on your terms", body: "Set a daily spending limit or take a break at any time from your account." },
];

export default async function LandingPage() {
  const [session, banners, announcements, activity, stats, maps] = await Promise.all([
    getAuthSession(),
    activeBanners("BANNER"),
    activeBanners("ANNOUNCEMENT"),
    recentActivity(24),
    landingStats(),
    landingMaps(),
  ]);
  const signedIn = Boolean(session);
  const showStats = stats.boxesOpened >= 50;

  return (
    <>
      <PromoTicker banners={banners.map((b) => ({ id: b.id, title: b.title, link: b.link }))} />

      <section className="relative isolate overflow-hidden bg-background">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_60%_at_78%_45%,var(--brand-soft),transparent_70%)]" />
        <Container className="grid items-center gap-4 pt-2 pb-10 sm:gap-6 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-16 lg:pb-16">
          <div className="text-center lg:text-left">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" aria-hidden /> Ten islands. Ten prizes.
            </p>
            <h1 className="mx-auto max-w-xl text-[2.35rem] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-6xl lg:mx-0 lg:text-7xl">
              Open the box.
              <br />
              Cross the islands.
              <br />
              Claim the prize.
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:mt-6 sm:text-lg lg:mx-0">
              <span className="sm:hidden">Collect Loot, reach every checkpoint and finish the puzzle to unlock each level&apos;s prize.</span>
              <span className="hidden sm:inline">
                Every Mystery Box drops Loot for your map. Reach the last checkpoint, open the Big Box for puzzle pieces, and finish the puzzle to unlock the prize for that level.
              </span>
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center lg:justify-start">
              {signedIn ? (
                <LandingButton asChild>
                  <Link href="/home">Continue my adventure</Link>
                </LandingButton>
              ) : (
                <LandingButton asChild>
                  <Link href="/register">Start free, spin today</Link>
                </LandingButton>
              )}
              <LandingButton asChild variant="outline">
                <Link href="/how-it-works">How it works</Link>
              </LandingButton>
            </div>
            <ul className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-semibold text-muted-foreground lg:justify-start" aria-label="Highlights">
              {[
                { icon: Gift, label: "Free daily spin" },
                { icon: ShieldCheck, label: "Server-decided results" },
                { icon: Lock, label: "18+ only" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5">
                  <Icon className="size-3.5 text-primary" aria-hidden /> {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-first mx-auto -mb-2 w-full max-w-[220px] sm:max-w-[360px] lg:order-none lg:mb-0 lg:max-w-none">
            <Hero3D />
          </div>
        </Container>
      </section>

      {activity.length >= MIN_ACTIVITY && <LiveTicker events={activity} />}

      {showStats && (
        <section className="border-b bg-surface">
          <Container className="grid grid-cols-3 gap-4 py-8 sm:py-14">
            <StatCounter value={stats.boxesOpened} label="boxes opened" />
            <StatCounter value={stats.prizesUnlocked} label="prizes unlocked" />
            <StatCounter value={stats.players} label="explorers" />
          </Container>
        </section>
      )}

      <section className="py-14 sm:py-24">
        <Container>
          <SectionHeading eyebrow="How a level works" title="Seven steps to every prize" description="Each of the ten levels runs the same loop. Learn it once, then chase it across every island." />
          <LoopJourney />
        </Container>
      </section>

      {maps.length > 0 && (
        <section className="overflow-hidden bg-surface py-14 sm:py-24">
          <Container>
            <SectionHeading
              eyebrow="The adventure"
              title={`${maps.length} islands, one treasure hunt`}
              description={`Start on ${maps[0].name}. Every map you finish opens the next, all the way to ${maps[maps.length - 1].name}.`}
              className="mb-0 sm:mb-0"
            />
            <LevelCarousel maps={maps} />
          </Container>
        </section>
      )}

      <section className="py-14 sm:py-24">
        <Container>
          <MarketShowcase />
        </Container>
      </section>

      <section className="bg-surface py-14 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Daily" title="Something to claim every day" description="A free spin, a check-in that grows your streak, three fresh missions and a new Daily Mystery to explore." />
          <DailyTeaser />
        </Container>
      </section>

      <section className="py-14 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Wallet" title="How your wallet works" description="Two balances, one simple flow. Cash comes in and goes out. Credits are what you play with." />
          <ol className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {MONEY_STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative rounded-3xl border bg-card p-4 sm:p-6">
                <span className="absolute top-3 right-4 font-heading text-3xl font-extrabold text-muted sm:top-5 sm:right-6 sm:text-5xl" aria-hidden>
                  {i + 1}
                </span>
                <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-primary sm:size-12">
                  <Icon className="size-5 sm:size-6" aria-hidden />
                </span>
                <h3 className="mt-3 text-base font-bold sm:mt-5 sm:text-lg">{title}</h3>
                <p className="mt-1 text-xs text-muted-foreground sm:mt-1.5 sm:text-sm">{body}</p>
              </li>
            ))}
          </ol>
          <Link href="/referrals" className="group mt-4 flex items-center gap-4 overflow-hidden rounded-3xl bg-brand-soft p-4 sm:mt-6 sm:p-6">
            <span className="relative size-16 shrink-0 sm:size-20">
              <Image src="/illustrations/3d/prize-gift.webp" alt="" fill sizes="80px" className="object-contain" />
            </span>
            <span className="flex-1">
              <span className="block font-heading text-xl font-extrabold">Bring your crew</span>
              <span className="mt-1 block text-sm text-muted-foreground">Share your invite link. You earn a reward when a friend makes their first deposit.</span>
            </span>
            <span className="hidden text-sm font-bold text-primary underline-offset-4 group-hover:underline sm:inline">See referral rewards</span>
          </Link>
        </Container>
      </section>

      <section className="bg-surface py-14 sm:py-24">
        <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <SectionHeading
              eyebrow="Trust"
              title="Fair by design, open by default"
              description="Every Mystery Box lists its possible rewards and their chances before you choose a spot. No hidden tables."
              className="mb-0 sm:mb-0"
            />
            <ul className="mt-8 space-y-5">
              {TRUST.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl border bg-card text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-bold">{title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <OddsBar />
        </Container>
      </section>

      <CtaBand signedIn={signedIn} />

      <PromoPopup promos={announcements.map((a) => ({ id: a.id, title: a.title, body: a.body || null, link: a.link }))} signedIn={signedIn} />
    </>
  );
}
