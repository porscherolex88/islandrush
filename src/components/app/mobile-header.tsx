import { Bell, ChevronLeft, Coins, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/shared/logo";
import { formatCredits, formatMYR } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Sticky top bar: brand, both balances (tap to open Wallet) and notifications. */
export function MobileHeader({ credits, withdrawable, unread }: { credits: bigint; withdrawable: bigint; unread: number }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 bg-background/90 px-4 backdrop-blur supports-backdrop-filter:bg-background/75">
      <Link href="/app" className="flex shrink-0 items-center gap-2 font-heading text-base font-bold" aria-label="LootBox home">
        <LogoMark className="size-8" />
        <span className="max-[399px]:sr-only">
          Loot<span className="text-primary">Box</span>
        </span>
      </Link>
      <div className="flex items-center gap-1.5">
        <Link
          href="/app/wallet"
          className="flex h-11 items-center gap-2 rounded-full border bg-card pr-3 pl-1.5 text-sm font-bold shadow-card tabular hover:bg-surface"
          aria-label={`Wallet: ${formatMYR(withdrawable)} withdrawable, ${formatCredits(credits)} Credits`}
        >
          <span className="flex items-center gap-1">
            <span className="grid size-7 place-items-center rounded-full bg-success-soft text-success">
              <Wallet className="size-3.5" aria-hidden />
            </span>
            {formatMYR(withdrawable).replace(".00", "")}
          </span>
          <span className="h-5 w-px bg-border" aria-hidden />
          <span className="flex items-center gap-1">
            <Coins className="size-4 text-gold" aria-hidden />
            {formatCredits(credits)}
          </span>
        </Link>
        <Link
          href="/app/notifications"
          className="relative grid size-11 place-items-center rounded-full hover:bg-muted"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] leading-[18px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

/** In-page title row with an optional back link. */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2 px-4 pt-2 pb-3", className)}>
      {back && (
        <Link href={back} className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted" aria-label="Back">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
      )}
      <div className="min-w-0 flex-1 pt-1.5">
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("px-4 py-2.5", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h2 className="flex items-center gap-2 font-heading text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-card", className)} {...props}>
      {children}
    </div>
  );
}
