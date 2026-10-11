import { Bell, Check, ChevronRight, Coins, Flame, Gem, History, Library, Map as MapIcon, Store, Sun, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { CreditsChip } from "@/components/app/mobile-header";
import { focusRing, RootIcon } from "@/components/app/kit";
import { DrawerTrigger } from "@/components/app/side-drawer";
import { ScrollFadeHeader } from "@/components/shared/scroll-fade-header";
import { Progress } from "@/components/ui/progress";
import type { FiatDisplay } from "@/lib/fiat-display.shared";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { cn } from "@/lib/utils";
import { getHeaderData } from "@/server/queries/header";
/*
 * Headers for the five bottom-nav destinations. Every one is the same compact sticky bar
 * (StickyBar + RootIcon + title) so the sections read as one product; page heroes use
 * HeroCard from the kit. There is no global logo, balance or notification bar. Inner pages (and Daily, a child of Home) use InnerPageHeader.
 */

/** Grows a compact chip's tap area to at least 44px without changing how it looks. */
const hitArea = "relative after:absolute after:-inset-1.5 after:content-['']";

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

/** Compact sticky frame shared by every root page: clears the safe area and never carries artwork. */
function StickyBar({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <ScrollFadeHeader as="div" className="z-30 pt-[env(safe-area-inset-top)]">
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
      href="/notifications"
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
          <StreakChip days={streak} href="/daily" className="shrink-0" />
        </div>

        <Link
          href="/wallet"
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
    <StickyBar right={<CreditsChip credits={credits} />}>
      <RootIcon icon={MapIcon} />
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
      <RootIcon icon={Store} />
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
      <InnerPageHeader title="Daily" subtitle="Your rewards & discoveries for today" back="/home" />

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

/* ---------------------------------------------------------------- Collections */

/** Collections: everything the player owns. The bar counts what can be sold versus kept. */
export function CollectionsHeader({ sellable, keepsakes }: { sellable: number; keepsakes: number }) {
  return (
    <StickyBar
      right={
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-bold whitespace-nowrap tabular" aria-label={`${sellable + keepsakes} things collected`}>
          <Gem className="size-4 text-gold" aria-hidden />
          {sellable + keepsakes}
        </span>
      }
    >
      <RootIcon icon={Library} />
      <div className="min-w-0">
        <BarTitle>Collections</BarTitle>
        <p className="truncate text-xs font-semibold text-muted-foreground">Everything you&apos;ve found</p>
      </div>
    </StickyBar>
  );
}

/* ---------------------------------------------------------------- Wallet */

/** Wallet: the bar names it with a history shortcut. Balances live in the page's HeroCard. */
export function WalletHeader() {
  return (
    <StickyBar
      right={
        <Link href="/wallet/transactions" className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-surface", focusRing)}>
          <History className="size-4" aria-hidden /> History
        </Link>
      }
    >
      <RootIcon icon={Wallet} />
      <BarTitle>Wallet</BarTitle>
    </StickyBar>
  );
}
