import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Coins,
  Flame,
  Gem,
  History,
  Landmark,
  Map as MapIcon,
  Puzzle,
  Repeat,
  Sparkles,
  Store,
  Sun,
  Trophy,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
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
 * logo, balance or notification bar. Inner pages (and Daily, a child of Home) use InnerPageHeader.
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
 * your streak and a compact wallet snapshot that opens the Wallet.
 */
export async function HomeHeader({
  userId,
  name,
  greeting,
  streak,
}: {
  userId: string;
  name: string;
  greeting: string;
  streak: number;
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
        <div className="flex items-center gap-2">
          <StreakChip days={streak} href="/app/daily" className="shrink-0" />
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

/** Play: the adventure. The bar names the current map and Adventure Level, with the Credits used to open boxes. */
export function PlayHeader({ level, totalLevels, mapName, credits }: { level: number; totalLevels: number; mapName: string | null; credits: bigint }) {
  return (
    <StickyBar tint="oklch(0.95 0.03 205)" right={<CreditsChip credits={credits} />}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
        <MapIcon className="size-5" />
      </span>
      <div className="min-w-0">
        <BarTitle>{mapName ?? "Play"}</BarTitle>
        <p className="truncate text-xs font-semibold text-muted-foreground tabular">
          Adventure Level {level} of {totalLevels}
        </p>
      </div>
    </StickyBar>
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
 * Daily is a child of Home, so it uses the inner header (back to Home). Below it, a warm
 * band with today's date, the streak and one completion indicator.
 */
export function DailyHeader({ timeZone, streak, done, total }: { timeZone: string; streak: number; done: number; total: number }) {
  const now = new Date();
  const fullDate = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(now);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <InnerPageHeader title="Daily" subtitle="Your rewards & discoveries for today" back="/app" />

      <header className="px-4 pt-1 md:px-5">
        <div className="relative isolate overflow-hidden rounded-3xl border border-amber-200/70 bg-[linear-gradient(180deg,oklch(0.965_0.05_78),oklch(0.99_0.015_85))] p-4">
          <Sun aria-hidden className="absolute top-3 right-3 -z-10 size-14 text-amber-400/40" strokeWidth={1.25} />
          <p className="text-xs font-bold tracking-widest text-orange-800 uppercase">Today</p>
          <p className="font-heading text-xl leading-tight font-extrabold">
            <time dateTime={now.toISOString()}>{fullDate}</time>
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <StreakChip days={streak} className="bg-white/85" />
            {total > 0 && (
              <span className={cn("text-sm font-bold tabular", done >= total ? "text-success" : "text-foreground")}>
                {done >= total ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-4" strokeWidth={3} aria-hidden /> All {total} done
                  </span>
                ) : (
                  `${done} of ${total} completed`
                )}
              </span>
            )}
          </div>
          {total > 0 && <Progress value={pct} className="mt-2.5 h-2.5 bg-white/80" indicatorClassName="bg-[linear-gradient(90deg,#fdba74,#f97316)]" aria-label={`${done} of ${total} daily activities completed`} />}
        </div>
      </header>
    </>
  );
}

/* ---------------------------------------------------------------- Progress */

/**
 * Progress: the player's collection. The bar names it and counts achievements; below it,
 * three tallies (Loot, puzzle pieces, achievements) that jump to their sections. No balances.
 */
export function ProgressHeader({
  lootFound,
  lootTotal,
  pieces,
  puzzlesDone,
  puzzlesTotal,
  earned,
  achievements,
}: {
  lootFound: number;
  lootTotal: number;
  pieces: number;
  puzzlesDone: number;
  puzzlesTotal: number;
  earned: number;
  achievements: number;
}) {
  const tiles = [
    { href: "#loot", label: "Loot found", value: `${lootFound}/${lootTotal}`, icon: Gem, tone: "bg-brand-soft text-primary" },
    { href: "#pieces", label: "Puzzle pieces", value: String(pieces), sub: `${puzzlesDone}/${puzzlesTotal} puzzles`, icon: Puzzle, tone: "bg-gold-soft text-gold-foreground" },
    { href: "#achievements", label: "Achievements", value: `${earned}/${achievements}`, icon: Trophy, tone: "bg-success-soft text-success" },
  ];
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
        <BarTitle>Your collection</BarTitle>
      </StickyBar>

      <header className={cn("relative isolate bg-[linear-gradient(180deg,oklch(0.97_0.035_88),transparent_85%)] px-4 pb-2 md:px-5", bleedUnderBar, "pt-[calc(66px+env(safe-area-inset-top)+0.25rem)]")}>
        <p className="text-sm text-muted-foreground">Everything you&apos;ve found on your adventure.</p>
        <nav aria-label="Collection sections" className="mt-3 grid grid-cols-3 gap-2">
          {tiles.map(({ href, label, value, sub, icon: Icon, tone }) => (
            <a key={href} href={href} className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-3 transition-colors hover:bg-surface", focusRing)}>
              <span className={cn("grid size-9 place-items-center rounded-full", tone)} aria-hidden>
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-heading text-xl leading-tight font-extrabold tabular">{value}</span>
                <span className="block truncate text-xs font-semibold text-muted-foreground">{label}</span>
                {sub && <span className="block truncate text-[11px] text-muted-foreground tabular">{sub}</span>}
              </span>
            </a>
          ))}
        </nav>
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
