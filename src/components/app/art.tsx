import { ChevronRight, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";

export const ART = {
  crate: "/illustrations/crate.webp",
  crate3d: "/illustrations/3d/crate.webp",
  crateOpen: "/illustrations/crate-open.webp",
  island: "/illustrations/island-map.webp",
  tidePool: "/illustrations/tide-pool.webp",
  bigBox: "/illustrations/adventure/big-box.webp",
  boxHub: "/illustrations/box-hub.webp",
} as const;

/** Default illustrated map for an adventure level, used when a map has no custom artwork. */
export function mapArt(level: number, artwork?: string | null) {
  if (artwork) return artwork;
  const n = ((Math.max(1, level) - 1) % 10) + 1;
  return `/illustrations/adventure/map-${n}.webp`;
}

/**
 * Large illustrated card: artwork fills the card, a scrim keeps the copy readable,
 * and the whole card is one big tap target.
 */
export function ArtCard({
  href,
  art,
  eyebrow,
  title,
  body,
  chips,
  cta,
  className,
  tall,
  top,
  priority,
}: {
  href: string;
  art: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  chips?: ReactNode;
  cta?: string;
  className?: string;
  tall?: boolean;
  /** Pins the copy to the top and the CTA to the bottom. */
  top?: boolean;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative isolate flex overflow-hidden rounded-3xl bg-ocean-deep text-white outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
        tall ? "min-h-64" : "min-h-48",
        className,
      )}
    >
      <Image src={art} alt="" fill sizes="(max-width: 430px) 100vw, 430px" priority={priority} className="-z-10 object-cover" />
      <div aria-hidden className="art-scrim absolute inset-0 -z-10" />
      <div className={cn("flex w-full flex-col gap-1 p-5 pr-[30%]", top ? "justify-start" : "justify-end")}>
        {eyebrow && <p className="text-xs font-bold text-amber-200">{eyebrow}</p>}
        <p className="font-heading text-2xl leading-tight font-extrabold">{title}</p>
        {body && <div className="text-sm text-white/85">{body}</div>}
        {chips && <div className="mt-1 flex flex-wrap gap-1.5">{chips}</div>}
        {cta && (
          <span className={cn(buttonVariants({ variant: "gold", size: "pill" }), top ? "mt-auto" : "mt-3", "w-fit group-hover:brightness-105")}>{cta}</span>
        )}
      </div>
    </Link>
  );
}

/**
 * Item token: the item's glyph set in a rarity-coloured medallion. Missing items render
 * as a dark silhouette so players can see what they are still looking for.
 */
export function Token({
  icon,
  rarity,
  owned = true,
  size = "md",
  quantity,
  className,
}: {
  icon: string;
  rarity?: string | null;
  owned?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  quantity?: number;
  className?: string;
}) {
  const r = rarityOf(rarity);
  const dims = { sm: "size-9 text-lg", md: "size-12 text-2xl", lg: "size-16 text-3xl", xl: "size-24 text-5xl" }[size];
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-2xl ring-2",
        owned ? cn(r.bg, r.ring, "") : "bg-muted ring-border",
        dims,
        className,
      )}
      aria-hidden
    >
      <span className={cn(!owned && "opacity-25 brightness-0")}>{icon}</span>
      {!owned && <Lock className="absolute -right-1 -bottom-1 size-4 rounded-full bg-background p-0.5 text-muted-foreground" />}
      {owned && quantity !== undefined && quantity > 1 && (
        <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-foreground px-1.5 text-[10px] leading-4 font-bold text-background">×{quantity}</span>
      )}
    </span>
  );
}

/** Compact tappable row used for "Today's progress" and "Continue your journey" lists. */
export function StatRow({ href, icon, label, value, done, className }: { href: string; icon: ReactNode; label: string; value: ReactNode; done?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("flex min-h-14 items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-surface", className)}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", done ? "bg-success-soft text-success" : "bg-brand-soft text-primary")}>{icon}</span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <span className={cn("text-sm font-bold tabular", done ? "text-success" : "text-foreground")}>{value}</span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
