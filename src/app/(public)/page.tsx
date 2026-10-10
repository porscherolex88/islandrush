import { Banknote, Lock, ShieldCheck, UserPlus, Users, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Container, CtaBand, LandingButton } from "@/components/public/marketing";
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

      <section className="relative isolate overflow-hidden bg-ocean-deep text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_75%_40%,oklch(0.42_0.09_210/0.9),transparent_70%),radial-gradient(ellipse_60%_50%_at_10%_100%,oklch(0.36_0.08_190/0.7),transparent_70%)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(to_top,oklch(0.2_0.045_230),transparent)]" />
        <Container className="grid items-center gap-6 pt-4 pb-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-16 lg:pb-12">
          <div className="text-center lg:text-left">
            <h1 className="mx-auto max-w-xl text-[2.5rem] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-6xl lg:mx-0 lg:text-7xl">
              Open the box.
              <br />
              Cross ten islands.
              <br />
              Claim the prize.
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-lg text-white/75 lg:mx-0">
              Every Mystery Box drops Loot for your map. Reach the last checkpoint, open the Big Box for puzzle pieces, and finish the puzzle to unlock the prize for that level.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              {signedIn ? (
                <LandingButton asChild>
                  <Link href="/app">Continue my adventure</Link>
                </LandingButton>
              ) : (
                <LandingButton asChild>
                  <Link href="/register">Start free, spin today</Link>
                </LandingButton>
              )}
              <LandingButton asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link href="/how-it-works">How it works</Link>
              </LandingButton>
            </div>
            <p className="mt-5 text-sm text-white/55">Free daily spin and check-in. 18+ only.</p>
          </div>
          <div className="order-first mx-auto -mb-4 w-full max-w-[260px] sm:max-w-[380px] lg:order-none lg:mb-0 lg:max-w-none">
            <Hero3D />
          </div>
        </Container>
      </section>

      {activity.length >= MIN_ACTIVITY && <LiveTicker events={activity} />}

      {showStats && (
        <section className="bg-[oklch(0.2_0.045_230)] text-white">
          <Container className="grid grid-cols-3 gap-4 py-10 sm:py-14">
            <StatCounter value={stats.boxesOpened} label="boxes opened" />
            <StatCounter value={stats.prizesUnlocked} label="prizes unlocked" />
            <StatCounter value={stats.players} label="explorers" />
          </Container>
        </section>
      )}

      <section className="py-16 sm:py-24">
        <Container>
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Seven steps to every prize</h2>
            <p className="mt-4 text-lg text-muted-foreground">Each of the ten levels runs the same loop. Learn it once, then chase it across every island.</p>
          </div>
          <LoopJourney />
        </Container>
      </section>

      {maps.length > 0 && (
        <section className="overflow-hidden bg-surface py-16 sm:py-24">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{maps.length} islands, one treasure hunt</h2>
              <p className="mt-4 text-lg text-muted-foreground">Start on {maps[0].name}. Every map you finish opens the next, all the way to {maps[maps.length - 1].name}.</p>
            </div>
            <LevelCarousel maps={maps} />
          </Container>
        </section>
      )}

      <section className="py-16 sm:py-24">
        <Container>
          <MarketShowcase />
        </Container>
      </section>

      <section className="bg-surface py-16 sm:py-24">
        <Container>
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Something to claim every day</h2>
            <p className="mt-4 text-lg text-muted-foreground">A free spin, a check-in that grows your streak, three fresh missions and a new Daily Mystery to explore.</p>
          </div>
          <DailyTeaser />
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container>
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">How your wallet works</h2>
            <p className="mt-4 text-lg text-muted-foreground">Two balances, one simple flow. Cash comes in and goes out. Credits are what you play with.</p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MONEY_STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative rounded-3xl border bg-card p-6">
                <span className="absolute top-5 right-6 font-heading text-5xl font-extrabold text-muted/80" aria-hidden>
                  {i + 1}
                </span>
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-primary">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
          <Link href="/referrals" className="group mt-6 flex flex-col items-start gap-4 overflow-hidden rounded-3xl bg-gold-soft p-6 sm:flex-row sm:items-center">
            <span className="relative size-20 shrink-0">
              <Image src="/illustrations/3d/gift.webp" alt="" fill sizes="80px" className="object-contain transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
            </span>
            <span className="flex-1">
              <span className="block font-heading text-xl font-extrabold">Bring your crew</span>
              <span className="mt-1 block text-sm text-gold-foreground">Share your invite link. You earn a reward when a friend makes their first deposit.</span>
            </span>
            <span className="text-sm font-bold text-gold-foreground underline-offset-4 group-hover:underline">See referral rewards</span>
          </Link>
        </Container>
      </section>

      <section className="bg-ocean-deep py-16 text-white sm:py-24">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Fair by design, open by default</h2>
            <p className="mt-4 text-lg text-white/70">Every Mystery Box lists its possible rewards and their chances before you choose a spot. No hidden tables.</p>
            <ul className="mt-8 space-y-5">
              {TRUST.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-gold">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-bold">{title}</span>
                    <span className="mt-0.5 block text-sm text-white/65">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <OddsBar />
        </Container>
      </section>

      <CtaBand />

      <PromoPopup promos={announcements.map((a) => ({ id: a.id, title: a.title, body: a.body || null, link: a.link }))} signedIn={signedIn} />
    </>
  );
}
