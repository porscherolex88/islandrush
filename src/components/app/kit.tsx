import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Shared building blocks for every signed-in app page, so each section reads as the same product:
 * one dark "ocean" hero style (matching the public landing hero), white bordered cards,
 * one segmented control and one action button style.
 */

export const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Dark ocean card with the landing hero's radial highlight. Use once per page, at the top. */
export function HeroCard({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-3xl bg-ocean-deep p-5 text-white shadow-[0_14px_30px_-16px_oklch(0.24_0.05_228/0.7)]",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_70%_at_90%_0%,oklch(0.42_0.09_210/0.9),transparent_70%),radial-gradient(ellipse_60%_60%_at_0%_100%,oklch(0.36_0.08_190/0.6),transparent_70%)]"
      />
      {children}
    </div>
  );
}

/** White bordered card used for lists and panels. */
export function ListCard({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border bg-card", className)} {...props}>
      {children}
    </div>
  );
}

/** Round icon badge used in every root sticky bar. */
export function RootIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-primary" aria-hidden>
      <Icon className="size-5" />
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  href,
  tone = "bg-brand-soft text-primary",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: string;
  className?: string;
}) {
  const body = (
    <>
      {Icon && (
        <span className={cn("grid size-9 place-items-center rounded-full", tone)} aria-hidden>
          <Icon className="size-[18px]" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-heading text-xl leading-tight font-extrabold tabular">{value}</span>
        <span className="block truncate text-xs font-semibold text-muted-foreground">{label}</span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground tabular">{sub}</span>}
      </span>
    </>
  );
  const cls = cn("flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-3", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-surface", focusRing)}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Large round money/game action: icon in a tile with a label underneath. */
export function ActionButton({ href, label, icon: Icon, primary, className }: { href: string; label: string; icon: LucideIcon; primary?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("group flex flex-col items-center gap-1.5 rounded-2xl py-1 text-xs font-bold", focusRing, className)}>
      <span
        className={cn(
          "grid size-14 place-items-center rounded-2xl transition-colors",
          primary ? "bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.76_0.16_70))] text-[oklch(0.3_0.08_55)] group-hover:brightness-105" : "border bg-card text-primary group-hover:bg-surface",
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      {label}
    </Link>
  );
}

/** Pill-shaped tab bar driven by links (search params), shared by Market and Collections. */
export function SegmentedNav({ label, items, className }: { label: string; items: { href: string; label: string; active: boolean; count?: number }[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn("grid gap-1 rounded-full bg-muted p-1", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "flex h-9 min-w-0 items-center justify-center gap-1 truncate rounded-full px-2 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            t.active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="text-xs text-muted-foreground tabular">({t.count})</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Small uppercase label used above hero numbers. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-bold tracking-widest uppercase", className)}>{children}</p>;
}
