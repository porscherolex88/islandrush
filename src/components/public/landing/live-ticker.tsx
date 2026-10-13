"use client";

import { Gift, Package, Puzzle } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { ActivityKind, LandingActivity } from "@/server/queries/landing";
import { Marquee } from "./marquee";

const KIND: Record<ActivityKind, { icon: typeof Gift; verb: string; tint: string }> = {
  box: { icon: Package, verb: "opened", tint: "bg-primary text-primary-foreground" },
  bigbox: { icon: Puzzle, verb: "found", tint: "bg-brand-soft text-primary" },
  prize: { icon: Gift, verb: "unlocked", tint: "bg-gold text-[var(--gold-ink)]" },
};

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function describe(e: LandingActivity) {
  if (e.kind === "box") return e.detail ?? (e.level ? `a Level ${e.level} box` : "a Mystery Box");
  if (e.kind === "bigbox") return `${e.detail ?? "puzzle pieces"}${e.level ? ` on Level ${e.level}` : ""}`;
  return e.detail ?? (e.level ? `the Level ${e.level} prize` : "a prize");
}

const TICK_MS = 30_000;

function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

/** Current time rounded to the tick, so the snapshot stays stable between ticks. Null on the server. */
function useClock() {
  return useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => null,
  );
}

export function LiveTicker({ events }: { events: LandingActivity[] }) {
  const now = useClock();

  return (
    <div className="flex items-center border-y bg-background text-foreground">
      <Marquee label="Recent player activity" duration={Math.max(30, events.length * 5)} className="flex-1">
        {events.map((e) => {
          const k = KIND[e.kind];
          const Icon = k.icon;
          return (
            <span key={e.id} className="flex h-14 items-center gap-2.5 px-5 text-sm whitespace-nowrap">
              <span className={`grid size-7 place-items-center rounded-full ${k.tint}`}>
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span>
                <strong className="font-semibold">{e.player}</strong> <span className="text-muted-foreground">{k.verb}</span> <strong className="font-semibold text-primary">{describe(e)}</strong>
              </span>
              {now !== null && <span className="text-xs text-muted-foreground">{ago(e.at, now)}</span>}
            </span>
          );
        })}
      </Marquee>
    </div>
  );
}
