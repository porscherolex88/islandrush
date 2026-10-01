import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type TrackLevel = { level: number; state: "done" | "current" | "open" | "locked"; label: string };

/**
 * Ten numbered stops joined by a route line. Every stop is a 44px link; locked stops stay
 * tappable so players can see what unlocks them.
 */
export function LevelTrack({ levels, active, hrefFor, label }: { levels: TrackLevel[]; active?: number; hrefFor: (level: number) => string; label: string }) {
  return (
    <nav aria-label={label} className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <ol className="relative flex min-w-max items-center gap-2 py-1">
        <span aria-hidden className="absolute inset-x-5 top-1/2 h-0.5 -translate-y-1/2 border-t-2 border-dashed border-border" />
        {levels.map((l) => {
          const isActive = l.level === active;
          return (
            <li key={l.level} className="relative">
              <Link
                href={hrefFor(l.level)}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Level ${l.level}: ${l.label}`}
                className={cn(
                  "grid size-11 place-items-center rounded-full font-heading text-sm font-extrabold tabular ring-2 ring-offset-2 ring-offset-background transition-transform outline-none focus-visible:ring-ring",
                  l.state === "done" && "bg-success text-white ring-transparent",
                  l.state === "current" && "bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.76_0.16_70))] text-amber-950 ring-gold/60",
                  l.state === "open" && "bg-primary text-primary-foreground ring-transparent",
                  l.state === "locked" && "bg-muted text-muted-foreground ring-transparent",
                  isActive && "scale-110 ring-foreground/70",
                )}
              >
                {l.state === "done" ? <Check className="size-5" strokeWidth={3} aria-hidden /> : l.state === "locked" ? <Lock className="size-4" aria-hidden /> : l.level}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
