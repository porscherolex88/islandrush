import { Bell, ChevronRight, Coins, Compass, Flame, Pencil, Star, Sun, Trophy, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/shared/logo";
import { Progress } from "@/components/ui/progress";
import { formatCredits, formatMYR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getHeaderData } from "@/server/queries/header";
import { ART } from "./art";

/*
 * Root-page headers for the five bottom-nav destinations. They share one frame (a compact
 * sticky brand bar with the wallet and notifications, then a hero block) but each hero has
 * its own composition. Inner pages use InnerPageHeader instead.
 */

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
/** Grows a compact chip's tap area to at least 44px without changing how it looks. */
const hitArea = "relative after:absolute after:-inset-1.5 after:content-['']";

function shortMYR(minor: bigint) {
  return formatMYR(minor).replace(/\.00$/, "");
}

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function WalletPill({ withdrawable, credits }: { withdrawable: bigint; credits: bigint }) {
  return (
    <Link
      href="/app/wallet"
      className={cn("flex h-11 min-w-0 items-center gap-2 rounded-full border bg-card pr-3 pl-1.5 text-sm font-bold shadow-card tabular transition-colors hover:bg-surface", focusRing)}
      aria-label={`Open Wallet: ${formatMYR(withdrawable)} withdrawable, ${formatCredits(credits)} Credits`}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success-soft text-success">
          <Wallet className="size-3.5" aria-hidden />
        </span>
        <span className="truncate">{shortMYR(withdrawable)}</span>
      </span>
      <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
      <span className="flex min-w-0 items-center gap-1">
        <Coins className="size-4 shrink-0 text-gold" aria-hidden />
        <span className="truncate">{formatCredits(credits)}</span>
      </span>
    </Link>
  );
}

function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/app/notifications"
      className={cn("relative grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted", focusRing)}
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] leading-[18px] font-bold text-white" aria-hidden>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.72_0.16_65))] font-heading font-extrabold text-amber-950 shadow-card ring-4 ring-gold-soft",
        className,
      )}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

/** Small uppercase h1 that names the destination; the hero's big line carries the content. */
function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn("flex items-center gap-1.5 font-sans text-xs font-bold tracking-[0.14em] uppercase", className)}>{children}</h1>;
}

function StreakChip({ days, href, className }: { days: number; href?: string; className?: string }) {
  const body = (
    <>
      <Flame className="size-4" aria-hidden />
      <span className="tabular">{days}</span> Day Streak
    </>
  );
  const cls = cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-orange-100 px-3.5 text-sm font-bold whitespace-nowrap text-orange-800", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-orange-200/70", hitArea, focusRing)} aria-label={`${days} day streak, open Daily`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/**
 * Shared frame: a compact sticky bar (brand, wallet, notifications) that respects the
 * safe area, followed by the destination's hero, which scrolls away normally.
 */
function RootHeaderFrame({ bar, children, className, roomyBar }: { bar: ReactNode; children: ReactNode; className?: string; roomyBar?: boolean }) {
  return (
    <>
      <div className="sticky top-0 z-30 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/75">
        <div className="flex h-14 items-center justify-between gap-2 px-4 md:h-16 md:px-5">
          <span className="flex min-w-0 items-center gap-2 font-heading text-base font-bold">
            <LogoMark className="size-8 shrink-0" />
            <span className={cn(!roomyBar && "max-[399px]:sr-only")}>
              Loot<span className="text-primary">Box</span>
            </span>
          </span>
          <div className="flex min-w-0 items-center gap-1.5">{bar}</div>
        </div>
      </div>
      <header className={cn("px-4 pt-1 pb-3 md:px-5 md:pt-2 md:pb-4", className)}>{children}</header>
    </>
  );
}

async function StandardBar({ userId }: { userId: string }) {
  const { balances, unread } = await getHeaderData(userId);
  return (
    <>
      <WalletPill withdrawable={balances.WITHDRAWABLE} credits={balances.CREDITS} />
      <NotificationBell unread={unread} />
    </>
  );
}

/* ---------------------------------------------------------------- Home */

/** Home: greeting, streak and the wallet summary. The wallet lives in the hero, so the bar only carries notifications. */
export async function HomeHeader({ userId, name, greeting, streak }: { userId: string; name: string; greeting: string; streak: number }) {
  const { balances, unread } = await getHeaderData(userId);
  const firstName = name.split(" ")[0] || name;
  const extras = balances.CASH > 0n || balances.PENDING_REWARDS > 0n;

  return (
    <RootHeaderFrame bar={<NotificationBell unread={unread} />} roomyBar>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="leading-tight">
            <span className="block font-sans text-sm font-semibold text-muted-foreground">
              {greeting} <span aria-hidden>👋</span>
            </span>
            <span className="block truncate text-[1.75rem] font-extrabold md:text-3xl" title={name}>
              {firstName}
            </span>
          </h1>
          <StreakChip days={streak} href="/app/daily" className="mt-2" />
        </div>
        <Link href="/app/account" className={cn("rounded-full", focusRing)} aria-label="Open Account">
          <UserAvatar name={name} className="size-12 text-base ring-[3px]" />
        </Link>
      </div>

      <Link
        href="/app/wallet"
        className={cn("group mt-3 block overflow-hidden rounded-2xl border bg-card shadow-card transition-colors hover:bg-surface", focusRing)}
        aria-label={`Open Wallet: ${formatMYR(balances.WITHDRAWABLE)} withdrawable, ${formatCredits(balances.CREDITS)} Credits`}
      >
        <span className="flex items-stretch">
          <span className="grid min-w-0 flex-1 grid-cols-2 divide-x">
            <span className="min-w-0 px-4 py-3">
              <span className="block truncate font-heading text-xl font-extrabold tabular md:text-2xl">{shortMYR(balances.WITHDRAWABLE)}</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Wallet className="size-3.5 text-success" aria-hidden /> Withdrawable
              </span>
            </span>
            <span className="min-w-0 px-4 py-3">
              <span className="block truncate font-heading text-xl font-extrabold tabular md:text-2xl">{formatCredits(balances.CREDITS)}</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Coins className="size-3.5 text-gold" aria-hidden /> Credits
              </span>
            </span>
          </span>
          <span className="grid w-10 shrink-0 place-items-center text-muted-foreground transition-transform group-hover:translate-x-0.5">
            <ChevronRight className="size-5" aria-hidden />
          </span>
        </span>
        {extras && (
          <span className="block truncate border-t bg-surface/70 px-4 py-2 text-xs text-muted-foreground">
            {balances.CASH > 0n && (
              <>
                <strong className="text-foreground tabular">{shortMYR(balances.CASH)}</strong> Cash ready to convert
              </>
            )}
            {balances.CASH > 0n && balances.PENDING_REWARDS > 0n && " · "}
            {balances.PENDING_REWARDS > 0n && (
              <>
                <strong className="text-foreground tabular">{shortMYR(balances.PENDING_REWARDS)}</strong> under review
              </>
            )}
          </span>
        )}
      </Link>
    </RootHeaderFrame>
  );
}

/* ---------------------------------------------------------------- Play */

/** Play: an exploration banner on chart paper with the island fading in from the right. */
export async function PlayHeader({ userId }: { userId: string }) {
  return (
    <RootHeaderFrame bar={<StandardBar userId={userId} />}>
      <div className="relative isolate overflow-hidden rounded-3xl border bg-brand-soft/60">
        <span
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70"
          style={{ backgroundImage: "radial-gradient(oklch(0.47 0.095 215 / 0.16) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
        />
        <span aria-hidden className="absolute inset-y-0 right-0 -z-10 w-[48%]" style={{ maskImage: "linear-gradient(to left, black 45%, transparent)", WebkitMaskImage: "linear-gradient(to left, black 45%, transparent)" }}>
          <Image src={ART.island} alt="" fill sizes="220px" className="object-cover object-[center_70%]" priority />
        </span>
        <div className="flex min-h-28 flex-col justify-center p-4 pr-[38%] md:min-h-32 md:p-5 md:pr-[40%]">
          <Eyebrow className="text-primary">
            <span className="grid size-6 place-items-center rounded-full bg-card shadow-card" aria-hidden>
              <Compass className="size-3.5" />
            </span>
            Play
          </Eyebrow>
          <p className="mt-1.5 font-heading text-xl leading-tight font-extrabold md:text-2xl">Explore. Discover. Unlock.</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground md:text-sm">Choose your adventure</p>
        </div>
      </div>
    </RootHeaderFrame>
  );
}

/* ---------------------------------------------------------------- Daily */

/** Daily: a calendar tile for today, the ritual framing, streak and how much of today is done. */
export async function DailyHeader({ userId, timeZone, streak, done, total }: { userId: string; timeZone: string; streak: number; done: number; total: number }) {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-MY", { timeZone, weekday: "short" }).format(now);
  const day = new Intl.DateTimeFormat("en-MY", { timeZone, day: "numeric" }).format(now);
  const fullDate = new Intl.DateTimeFormat("en-MY", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(now);
  const allDone = total > 0 && done >= total;

  return (
    <RootHeaderFrame bar={<StandardBar userId={userId} />}>
      <div className="relative isolate overflow-hidden rounded-3xl border border-amber-200/70 bg-[linear-gradient(160deg,oklch(0.97_0.045_80),oklch(0.995_0.01_85))] p-4 md:p-5">
        <Sun aria-hidden className="absolute -top-5 -right-5 -z-10 size-28 text-amber-300/35" strokeWidth={1.5} />
        <div className="flex items-center gap-3">
          <time dateTime={now.toISOString()} className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-2xl border bg-card shadow-card" title={fullDate}>
            <span className="w-full bg-orange-500 py-0.5 text-center text-[10px] font-bold tracking-wider text-white uppercase">{weekday}</span>
            <span className="py-1 font-heading text-2xl leading-none font-extrabold tabular">{day}</span>
          </time>
          <div className="min-w-0">
            <Eyebrow className="text-orange-700">Today</Eyebrow>
            <p className="mt-0.5 font-heading text-lg leading-tight font-extrabold text-balance md:text-xl">Your daily rewards &amp; discoveries</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StreakChip days={streak} className="bg-white/80 shadow-card" />
          <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold whitespace-nowrap shadow-card", allDone ? "bg-success-soft text-success" : "bg-white/80 text-foreground")}>
            <span className="tabular">
              {done} / {total}
            </span>{" "}
            done today
          </span>
        </div>
      </div>
    </RootHeaderFrame>
  );
}

/* ---------------------------------------------------------------- Progress */

/** Progress: level medallion, rank title and the XP bar, with trophy artwork. */
export async function ProgressHeader({
  userId,
  level,
  title,
  xp,
  pct,
  toNext,
  nextTitle,
}: {
  userId: string;
  level: number;
  title: string;
  xp: number;
  pct: number;
  toNext: number;
  nextTitle: string | null;
}) {
  return (
    <RootHeaderFrame bar={<StandardBar userId={userId} />}>
      <div className="relative isolate overflow-hidden rounded-3xl border bg-card p-4 shadow-card md:p-5">
        <span aria-hidden className="absolute -top-16 -right-12 -z-10 size-44 rounded-full bg-gold-soft" />
        <Trophy aria-hidden className="absolute top-3 right-3 -z-10 size-12 text-gold/40" strokeWidth={1.5} />
        <div className="flex items-center gap-3.5">
          <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.72_0.16_65))] font-heading text-2xl font-extrabold text-amber-950 shadow-lift" aria-hidden>
            {level}
            <span className="absolute -bottom-2 rounded-full bg-white px-1.5 text-[9px] font-bold tracking-wide text-amber-800 uppercase shadow">Level</span>
          </span>
          <div className="min-w-0 flex-1 pr-10">
            <Eyebrow className="text-primary">Your progress</Eyebrow>
            <p className="mt-0.5 truncate font-heading text-xl leading-tight font-extrabold md:text-2xl">
              Level {level} · {title}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-muted-foreground tabular">{xp.toLocaleString("en-MY")} XP earned</p>
          </div>
        </div>
        <Progress value={pct} className="mt-4 h-2.5" indicatorClassName="bg-[linear-gradient(90deg,#fcd34d,#f59e0b)]" aria-label="Progress to next level" />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {nextTitle ? (
            <>
              <strong className="text-foreground tabular">{toNext.toLocaleString("en-MY")} XP</strong> to {nextTitle}. Earn XP by playing, missions and your streak.
            </>
          ) : (
            "Maximum level reached. Legendary explorer."
          )}
        </p>
      </div>
    </RootHeaderFrame>
  );
}

/* ---------------------------------------------------------------- Account */

/** Account: the player's identity card, with avatar, rank and streak. */
export async function AccountHeader({
  userId,
  name,
  email,
  level,
  title,
  streak,
  joined,
}: {
  userId: string;
  name: string;
  email: string;
  level: number;
  title: string;
  streak: number;
  joined: Date;
}) {
  return (
    <RootHeaderFrame bar={<StandardBar userId={userId} />}>
      <div className="rounded-3xl border bg-surface/70 p-4 md:p-5">
        <div className="flex items-center gap-4">
          <Link href="/app/account/profile" className={cn("relative rounded-full", focusRing)} aria-label="Edit profile">
            <UserAvatar name={name} className="size-[4.5rem] text-2xl" />
            <span className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground" aria-hidden>
              <Pencil className="size-3" />
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <Eyebrow className="text-muted-foreground">Your account</Eyebrow>
            <p className="mt-0.5 truncate font-heading text-2xl leading-tight font-extrabold" title={name}>
              {name}
            </p>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gold-foreground">
              <Star className="size-4 shrink-0" aria-hidden />
              <span className="truncate">
                Level {level} · {title}
              </span>
            </p>
            <p className="truncate text-xs text-muted-foreground" title={email}>
              {email}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StreakChip days={streak} className="h-8 bg-orange-100/80 px-3 text-xs" />
          <span className="inline-flex h-8 items-center rounded-full bg-card px-3 text-xs font-semibold whitespace-nowrap text-muted-foreground ring-1 ring-border">
            Joined {joined.toLocaleDateString("en-MY", { month: "short", year: "numeric" })}
          </span>
        </div>
      </div>
    </RootHeaderFrame>
  );
}
