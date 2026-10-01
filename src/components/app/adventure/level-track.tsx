import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type TrackLevel = { level: number; state: "done" | "current" | "open" | "locked"; label: string };

/**
 * The whole adventure at a glance: numbered stops in rows of five, so all ten fit a 375px
 * screen without scrolling. Every stop is a 44px link; locked stops stay tappable so players
 * can see what unlocks them.
 */
export function LevelTrack({ levels, active, hrefFor, label }: { levels: TrackLevel[]; active?: number; hrefFor: (level: number) => string; label: string }) {
  return (
    <nav aria-label={label} className="rounded-3xl border bg-card px-2 py-3">
      <ol className="grid grid-cols-5 gap-y-3">
        {levels.map((l, i) => {
          const isActive = l.level === active;
          const rowEnd = i % 5 === 4 || i === levels.length - 1;
          return (
            <li key={l.level} className="relative flex flex-col items-center gap-2">
              {!rowEnd && (
                <span
                  aria-hidden
                  className={cn("absolute top-[22px] left-1/2 h-0.5 w-full", l.state === "done" ? "bg-success/60" : "border-t-2 border-dashed border-border bg-transparent")}
                />
              )}
              <Link
                href={hrefFor(l.level)}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Level ${l.level}: ${l.label}`}
                className={cn(
                  "relative grid size-11 place-items-center rounded-full font-heading text-sm font-extrabold tabular transition-transform outline-none focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-95",
                  l.state === "done" && "bg-success text-white",
                  l.state === "current" && "bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.76_0.16_70))] text-amber-950 shadow-md shadow-amber-500/30",
                  l.state === "open" && "bg-primary text-primary-foreground",
                  l.state === "locked" && "bg-muted text-muted-foreground",
                  isActive && "ring-[3px] ring-foreground/80 ring-offset-2 ring-offset-card",
                )}
              >
                {l.state === "done" ? <Check className="size-5" strokeWidth={3} aria-hidden /> : l.state === "locked" ? <Lock className="size-4" aria-hidden /> : l.level}
              </Link>
              <span aria-hidden className={cn("text-[10px] leading-none font-semibold tabular", isActive ? "text-foreground" : "text-muted-foreground")}>
                Lv {l.level}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
