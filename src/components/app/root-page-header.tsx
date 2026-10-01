import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock,
  Coins,
  Flame,
  History,
  Landmark,
  Map as MapIcon,
  Pencil,
  Repeat,
  Sparkles,
  Star,
  Store,
  Sun,
  Trophy,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { headerPillButton } from "@/components/app/header-buttons";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { CreditsChip } from "@/components/app/mobile-header";
import { DrawerTrigger } from "@/components/app/side-drawer";
import { ScrollFadeHeader } from "@/components/shared/scroll-fade-header";
import { Progress } from "@/components/ui/progress";
import type { FiatDisplay } from "@/lib/fiat-display.shared";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { cn } from "@/lib/utils";
import { getHeaderData } from "@/server/queries/header";
/*
 * Headers for the five bottom-nav destinations. Each one is a compact sticky bar that
 * names the section with its own identity, followed by a hero that scrolls away.
 * The bars share a frame (StickyBar) but never the same content: there is no global
 * logo, balance or notification bar. Inner pages use InnerPageHeader (AccountHeader wraps it).
 */

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
/** Grows a compact chip's tap area to at least 44px without changing how it looks. */
const hitArea = "relative after:absolute after:-inset-1.5 after:content-['']";
/** Pulls a full-bleed hero up behind the transparent sticky bar (66px + notch); pair with matching top padding. */
const bleedUnderBar = "-mt-[calc(66px+env(safe-area-inset-top))]";

function shortCash(minor: bigint, fiat: FiatDisplay) {
  return formatCash(minor, { currency: fiat }).replace(/\.00$/, "");
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

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.72_0.16_65))] font-heading font-extrabold text-amber-950 ring-4 ring-gold-soft",
        className,
      )}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

/** Compact sticky frame: clears the safe area, stays 56-64px tall and never carries artwork. */
function StickyBar({ children, right, tint }: { children: ReactNode; right?: ReactNode; tint?: string }) {
  return (
    <ScrollFadeHeader as="div" tint={tint} className="z-30 pt-[env(safe-area-inset-top)]">
      <div className="flex h-[66px] items-center gap-2.5 px-4 md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">{children}</div>
        {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
      </div>
    </ScrollFadeHeader>
  );
}

/** Section name in the sticky bar. */
function BarTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn("truncate font-heading text-lg leading-tight font-extrabold", className)}>{children}</h1>;
}

function StreakChip({ days, href, className }: { days: number; href?: string; className?: string }) {
  const body = (
    <>
      <Flame className="size-4" aria-hidden />
      <span className="tabular">{days}</span> day streak
    </>
  );
  const cls = cn("inline-flex h-9 items-center gap-1.5 rounded-full border border-current bg-orange-100 px-3.5 text-sm font-bold whitespace-nowrap text-orange-800", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-orange-200/70", hitArea, focusRing)} aria-label={`${days} day streak, open Daily`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/app/notifications"
      className={cn("relative grid size-11 shrink-0 place-items-center rounded-full border bg-card transition-colors hover:bg-surface", focusRing)}
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] leading-[18px] font-bold text-white ring-2 ring-background" aria-hidden>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

/* ---------------------------------------------------------------- Home */

/**
 * Home: a personal welcome. The bar greets you (avatar, name, notifications); below it,
 * where you stand (streak and level) and a compact wallet snapshot that opens the Wallet.
 */
export async function HomeHeader({
  userId,
  name,
  greeting,
  streak,
  level,
  title,
  pct,
}: {
  userId: string;
  name: string;
  greeting: string;
  streak: number;
  level: number;
  title: string;
  pct: number;
}) {
  const fiat = await getFiatDisplay();
  const { balances, unread } = await getHeaderData(userId);
  const firstName = name.split(" ")[0] || name;
  const extras = balances.CASH > 0n || balances.PENDING_REWARDS > 0n;

  return (
    <>
      <StickyBar right={<NotificationBell unread={unread} />}>
        <DrawerTrigger className={cn("shrink-0 rounded-full", focusRing)}>
          <UserAvatar name={name} className="size-10 text-sm ring-[3px]" />
        </DrawerTrigger>
        <h1 className="min-w-0 leading-none">
          <span className="block text-xs leading-none font-semibold text-muted-foreground">{greeting},</span>{" "}
          <span className="block truncate pb-0.5 font-heading text-lg leading-none font-extrabold" title={name}>
            {firstName}
          </span>
        </h1>
      </StickyBar>

      <header className="px-4 pt-1 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <StreakChip days={streak} href="/app/daily" />
          <Link
            href="/app/progress"
            className={cn("inline-flex h-9 min-w-0 items-center gap-2 rounded-full bg-gold-soft pr-3.5 pl-1 text-sm font-bold text-gold-foreground transition-colors hover:bg-amber-100", hitArea, focusRing)}
            aria-label={`Level ${level}, ${title}, ${pct}% to next level. Open Progress`}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-full font-heading text-xs font-extrabold text-amber-950"
              style={{ background: `conic-gradient(oklch(0.75 0.16 70) ${pct}%, oklch(0.9 0.05 85) 0)` }}
              aria-hidden
            >
              <span className="grid size-5 place-items-center rounded-full bg-gold-soft tabular">{level}</span>
            </span>
            <span className="truncate">{title}</span>
          </Link>
        </div>

        <Link
          href="/app/wallet"
          className={cn("group mt-3 block overflow-hidden rounded-2xl border bg-card transition-colors hover:bg-surface", focusRing)}
          aria-label={`Open Wallet: ${formatCash(balances.WITHDRAWABLE, { currency: fiat })} withdrawable, ${formatCredits(balances.CREDITS)} Credits`}
        >
          <span className="grid grid-cols-2 divide-x">
            <span className="min-w-0 px-4 py-3">
              <span className="block truncate font-heading text-xl font-extrabold tabular">{shortCash(balances.WITHDRAWABLE, fiat)}</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Wallet className="size-3.5 text-success" aria-hidden /> Withdrawable
              </span>
            </span>
            <span className="relative min-w-0 py-3 pr-9 pl-4">
              <span className="block truncate font-heading text-xl font-extrabold tabular">{formatCredits(balances.CREDITS)}</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Coins className="size-3.5 text-gold" aria-hidden /> Credits
              </span>
              <ChevronRight className="absolute top-1/2 right-2.5 size-5 -translate-y-1/2 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </span>
          {extras && (
            <span className="block truncate border-t bg-surface/70 px-4 py-2 text-xs text-muted-foreground">
              {balances.CASH > 0n && (
                <>
                  <strong className="text-foreground tabular">{shortCash(balances.CASH, fiat)}</strong> Cash ready to convert
                </>
              )}
              {balances.CASH > 0n && balances.PENDING_REWARDS > 0n && " · "}
              {balances.PENDING_REWARDS > 0n && (
                <>
                  <strong className="text-foreground tabular">{shortCash(balances.PENDING_REWARDS, fiat)}</strong> under review
                </>
              )}
            </span>
          )}
        </Link>
      </header>
    </>
  );
}

/* ---------------------------------------------------------------- Play */

/**
 * Play is an inner page reached from Home. The header keeps the adventure level chip,
 * which opens the current map.
 */
export function PlayHeader({ level, totalLevels, href }: { level: number; totalLevels: number; href: string }) {
  return (
    <InnerPageHeader
      title="Explore"
      action={
        <Link
          href={href}
          className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-sm font-bold whitespace-nowrap text-primary transition-colors hover:bg-sky-100", hitArea, focusRing)}
          aria-label={`Adventure level ${level} of ${totalLevels}, open current map`}
        >
          <MapIcon className="size-4" aria-hidden />
          Level <span className="tabular">{level}/{totalLevels}</span>
        </Link>
      }
    />
  );
}

/* ---------------------------------------------------------------- Market */

/** Market: a trading post. The bar carries the Credits balance, since every trade is priced in Credits. */
export function MarketHeader({ credits }: { credits: bigint }) {
  return (
    <StickyBar right={<CreditsChip credits={credits} />}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold text-white" aria-hidden>
        <Store className="size-5" />
      </span>
      <BarTitle>Market</BarTitle>
    </StickyBar>
  );
}

/* ---------------------------------------------------------------- Daily */

/**
 * Daily: a morning ritual. The bar carries today's calendar tile and the streak; below it,
 * a warm band with a row of dots for today's activities so it reads as a checklist.
 */
export function DailyHeader({ timeZone, streak, done, total }: { timeZone: string; streak: number; done: number; total: number }) {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-MY", { timeZone, weekday: "short" }).format(now);
  const day = new Intl.DateTimeFormat("en-MY", { timeZone, day: "numeric" }).format(now);
  const fullDate = new Intl.DateTimeFormat("en-MY", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(now);
  const waiting = Math.max(0, total - done);

  return (
    <>
      <StickyBar right={<StreakChip days={streak} className="bg-white/85" />}>
        <time dateTime={now.toISOString()} className="flex w-10 shrink-0 flex-col items-center overflow-hidden rounded-xl border bg-card" title={fullDate}>
          <span className="w-full bg-orange-500 text-center text-[9px] leading-[14px] font-bold text-white">{weekday}</span>
          <span className="py-0.5 font-heading text-base leading-tight font-extrabold tabular">{day}</span>
        </time>
        <BarTitle className="text-orange-800">Today</BarTitle>
      </StickyBar>

      <header className={cn("relative isolate overflow-hidden border-b border-amber-200/60 bg-[linear-gradient(180deg,oklch(0.965_0.05_78),oklch(0.99_0.015_85))] px-4 pb-4 md:px-5", bleedUnderBar, "pt-[calc(66px+env(safe-area-inset-top)+0.25rem)]")}>
        <span aria-hidden className="absolute -top-24 -right-16 -z-10 size-56 rounded-full bg-[radial-gradient(circle,oklch(0.9_0.12_80/0.7),transparent_65%)]" />
        <Sun aria-hidden className="absolute top-[calc(66px+env(safe-area-inset-top))] right-4 -z-10 size-14 text-amber-400/50" strokeWidth={1.25} />

        <p className="pr-16 font-heading text-xl leading-tight font-extrabold text-balance">Keep your streak going.</p>
        {total > 0 && (
          <div className="mt-3 flex items-center gap-2.5 text-sm font-bold">
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={cn("grid size-6 place-items-center rounded-full", i < done ? "bg-success text-white" : "border-2 border-dashed border-amber-300 bg-white/70")}>
                  {i < done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              ))}
            </span>
            <span className={cn("whitespace-nowrap", waiting ? "text-foreground" : "text-success")}>
              {waiting ? (
                <>
                  <span className="tabular">{waiting}</span> {waiting === 1 ? "activity" : "activities"} waiting
                </>
              ) : (
                "All done for today"
              )}
            </span>
            <span className="sr-only">
              {done} of {total} activities done today
            </span>
          </div>
        )}
      </header>
    </>
  );
}

/* ---------------------------------------------------------------- Progress */

/**
 * Progress: a journey. The bar names it and counts achievements; below it, a centred
 * level medallion, rank title and the XP bar towards the next rank. No balances.
 */
export function ProgressHeader({
  level,
  title,
  xp,
  xpNext,
  pct,
  toNext,
  nextTitle,
  earned,
  achievements,
}: {
  level: number;
  title: string;
  xp: number;
  xpNext: number | null;
  pct: number;
  toNext: number;
  nextTitle: string | null;
  earned: number;
  achievements: number;
}) {
  return (
    <>
      <StickyBar
        tint="oklch(0.97 0.035 88)"
        right={
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-sm font-bold whitespace-nowrap tabular" aria-label={`${earned} of ${achievements} achievements earned`}>
            <Trophy className="size-4 text-gold" aria-hidden />
            {earned} / {achievements}
          </span>
        }
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-foreground ring-1 ring-gold/30" aria-hidden>
          <Sparkles className="size-[18px]" />
        </span>
        <BarTitle>Your journey</BarTitle>
      </StickyBar>

      <header className={cn("relative isolate overflow-hidden bg-[linear-gradient(180deg,oklch(0.97_0.035_88),transparent_75%)] px-4 pb-4 text-center md:px-5", bleedUnderBar, "pt-[calc(66px+env(safe-area-inset-top)+0.5rem)]")}>
        <Star aria-hidden className="absolute top-[calc(86px+env(safe-area-inset-top))] left-[14%] -z-10 size-5 fill-gold/30 text-gold/40" />
        <Sparkles aria-hidden className="absolute top-[calc(114px+env(safe-area-inset-top))] right-[15%] -z-10 size-6 text-gold/50" />

        <div className="flex items-center justify-center gap-3.5">
          <span className="relative grid size-16 shrink-0 rotate-45 place-items-center rounded-2xl bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.72_0.16_65))] ring-4 ring-gold-soft" aria-hidden>
            <span className="-rotate-45 font-heading text-2xl font-extrabold text-amber-950 tabular">{level}</span>
          </span>
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold text-muted-foreground">Level {level}</p>
            <p className="truncate font-heading text-2xl leading-tight font-extrabold">{title}</p>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-sm rounded-2xl border bg-card/90 p-3 text-left">
          <p className="text-sm font-bold tabular">
            {xp.toLocaleString("en-MY")}
            {xpNext ? <span className="text-muted-foreground"> / {xpNext.toLocaleString("en-MY")}</span> : null} XP
          </p>
          <Progress value={pct} className="mt-2 h-2.5" indicatorClassName="bg-[linear-gradient(90deg,#fcd34d,#f59e0b)]" aria-label="Progress to next level" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {nextTitle ? (
              <>
                <strong className="text-foreground tabular">{toNext.toLocaleString("en-MY")} XP</strong> to {nextTitle}
              </>
            ) : (
              "Maximum level reached. Legendary explorer."
            )}
          </p>
        </div>
      </header>
    </>
  );
}

/* ---------------------------------------------------------------- Wallet */

const WALLET_ACTIONS = [
  { href: "/app/wallet/deposit", label: "Deposit", icon: ArrowDownToLine, tone: "bg-primary text-primary-foreground hover:bg-primary/90" },
  { href: "/app/wallet/convert", label: "Convert", icon: Repeat, tone: "bg-gold-soft text-gold-foreground hover:bg-amber-100" },
  { href: "/app/wallet/withdraw", label: "Withdraw", icon: ArrowUpFromLine, tone: "bg-success-soft text-success hover:bg-emerald-100" },
  { href: "/app/account/withdrawal-accounts", label: "Bank", icon: Landmark, tone: "border bg-card text-foreground hover:bg-surface" },
] as const;

/**
 * Wallet: the player's money. The bar names it with a history action; below it, a balance
 * card led by what can be withdrawn, then the four money actions as large tiles.
 */
export function WalletHeader({
  withdrawable,
  cash,
  credits,
  rate,
  pending,
  outgoing,
}: {
  withdrawable: string;
  cash: string;
  credits: string;
  rate: string;
  pending: string | null;
  outgoing: string | null;
}) {
  return (
    <>
      <StickyBar
        tint="oklch(0.95 0.03 205)"
        right={
          <Link
            href="/app/wallet/transactions"
            className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-surface", focusRing)}
          >
            <History className="size-4" aria-hidden /> History
          </Link>
        }
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
          <Wallet className="size-5" />
        </span>
        <BarTitle>Wallet</BarTitle>
      </StickyBar>

      <header className={cn("relative isolate bg-[linear-gradient(180deg,oklch(0.95_0.03_205),transparent_85%)] px-4 pb-3 md:px-5", bleedUnderBar, "pt-[calc(66px+env(safe-area-inset-top)+0.25rem)]")}>
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_0%,oklch(0.52_0.1_200),oklch(0.33_0.07_222)_75%)] p-5 text-white shadow-[0_12px_30px_-14px_oklch(0.33_0.07_222/0.7)]">
          <span aria-hidden className="absolute -top-16 -right-10 size-44 rounded-full bg-white/10" />
          <span aria-hidden className="absolute -bottom-20 -left-12 size-40 rounded-full bg-white/5" />

          <p className="relative flex items-center gap-1.5 text-sm font-semibold text-white/80">
            <Landmark className="size-4" aria-hidden /> Withdrawable
          </p>
          <p className="relative mt-0.5 truncate font-heading text-4xl font-extrabold tabular">{withdrawable}</p>
          <p className="relative text-sm text-white/75">Ready to send to your bank</p>

          <dl className="relative mt-4 grid grid-cols-2 divide-x divide-white/15 rounded-2xl bg-white/10">
            <div className="min-w-0 px-3.5 py-2.5">
              <dt className="flex items-center gap-1 text-xs font-semibold text-white/75">
                <Wallet className="size-3.5" aria-hidden /> Cash
              </dt>
              <dd className="truncate font-heading text-lg font-bold tabular">{cash}</dd>
            </div>
            <div className="min-w-0 px-3.5 py-2.5">
              <dt className="flex items-center gap-1 text-xs font-semibold text-white/75">
                <Coins className="size-3.5 text-amber-300" aria-hidden /> Credits
              </dt>
              <dd className="truncate font-heading text-lg font-bold tabular">{credits}</dd>
            </div>
          </dl>
          <p className="relative mt-2 text-xs text-white/70">{rate}</p>

          {(pending || outgoing) && (
            <div className="relative mt-3 space-y-1 border-t border-white/15 pt-3 text-xs text-white/85">
              {pending && (
                <p className="flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  <strong className="tabular">{pending}</strong> in rewards under review
                </p>
              )}
              {outgoing && (
                <p className="flex items-center gap-1.5">
                  <ArrowUpFromLine className="size-3.5" aria-hidden />
                  <strong className="tabular">{outgoing}</strong> on its way to your bank
                </p>
              )}
            </div>
          )}
        </div>

        <nav aria-label="Wallet actions" className="mt-4 grid grid-cols-4 gap-2">
          {WALLET_ACTIONS.map(({ href, label, icon: Icon, tone }) => (
            <Link key={href} href={href} className={cn("group flex flex-col items-center gap-1.5 rounded-2xl py-1 text-xs font-semibold", focusRing)}>
              <span className={cn("grid size-14 place-items-center rounded-2xl transition-colors", tone)}>
                <Icon className="size-6" aria-hidden />
              </span>
              {label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}

/* ---------------------------------------------------------------- Account */

/**
 * Account: the player's personal space, opened from the side drawer. An inner page with
 * an edit-profile action; below it, a profile card with avatar, name, rank, streak and membership.
 */
export function AccountHeader({
  name,
  email,
  level,
  title,
  streak,
  joined,
}: {
  name: string;
  email: string;
  level: number;
  title: string;
  streak: number;
  joined: Date;
}) {
  return (
    <>
      <InnerPageHeader
        title="Your account"
        action={
          <Link href="/app/account/profile" className={headerPillButton} aria-label="Edit profile">
            <Pencil className="size-4" aria-hidden /> Edit
          </Link>
        }
      />

      <header className="px-4 pt-1 pb-2 md:px-5">
        <div className="overflow-hidden rounded-3xl border bg-card">
          <div aria-hidden className="h-12 bg-[linear-gradient(120deg,oklch(0.93_0.04_205),oklch(0.95_0.05_88))]" />
          <div className="-mt-8 flex items-end gap-3.5 px-4">
            <Link href="/app/account/profile" className={cn("rounded-full", focusRing)} aria-label="Open profile">
              <UserAvatar name={name} className="size-[4.5rem] text-2xl ring-card" />
            </Link>
            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate font-heading text-xl leading-tight font-extrabold" title={name}>
                {name}
              </p>
              <p className="truncate text-xs text-muted-foreground" title={email}>
                {email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-4">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gold-soft px-3 text-xs font-bold whitespace-nowrap text-gold-foreground">
              <Star className="size-3.5" aria-hidden /> Level {level} · {title}
            </span>
            <StreakChip days={streak} className="h-8 px-3 text-xs" />
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold whitespace-nowrap text-muted-foreground">
              <CalendarCheck className="size-3.5" aria-hidden /> Joined {joined.toLocaleDateString("en-MY", { month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </header>
    </>
  );
}
