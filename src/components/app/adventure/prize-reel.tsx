"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { RewardGlyph, type PrizeKey, type PrizeTile } from "./prizes-list";

const TILE = 84;
const GAP = 8;
const STEP = TILE + GAP;
/** Copies of the prize strip, enough for the slowest loop plus two full turns before landing. */
const REPS = 8;
const LIGHTS = 9;

export type ReelStop = { key: PrizeKey; id: number };

/**
 * Slot-machine strip of everything a box can drop. It drifts while idle, spins fast while a box is
 * opening, then eases to a stop on the prize the server picked and calls `onLanded`.
 */
export function PrizeReel({
  tiles,
  spinning,
  landOn,
  onLanded,
  fast = false,
}: {
  tiles: PrizeTile[];
  spinning: boolean;
  landOn: ReelStop | null;
  onLanded: () => void;
  /** Shorter landings, for jackpot spins that run back to back. */
  fast?: boolean;
}) {
  const reduce = useReducedMotion();
  const windowRef = useRef<HTMLDivElement>(null);
  const landedCb = useRef(onLanded);
  const x = useMotionValue(0);
  const [width, setWidth] = useState(0);
  const [landed, setLanded] = useState<{ id: number; index: number } | null>(null);
  const len = tiles.length;
  const cycle = len * STEP;

  useEffect(() => {
    landedCb.current = onLanded;
  }, [onLanded]);

  useLayoutEffect(() => {
    const el = windowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !len || landOn) return;
    const centered = (j: number) => width / 2 - (j * STEP + TILE / 2);
    const base = centered(len);
    const from = base - ((((base - x.get()) % cycle) + cycle) % cycle);
    if (reduce) {
      x.set(base);
      return;
    }
    const controls = animate(x, [from, from - cycle], { duration: spinning ? 0.12 * len : 2.6 * len, ease: "linear", repeat: Infinity });
    return () => controls.stop();
  }, [width, len, cycle, spinning, landOn, reduce, x]);

  useEffect(() => {
    if (!landOn || !width || !len) return;
    const centered = (j: number) => width / 2 - (j * STEP + TILE / 2);
    const base = centered(len);
    const cur = base - ((((base - x.get()) % cycle) + cycle) % cycle);
    x.set(cur);
    const target = Math.max(0, tiles.findIndex((t) => t.key === landOn.key));
    const travel = reduce ? 0 : fast ? cycle : 2 * cycle;
    let j = Math.ceil((width / 2 - TILE / 2 - cur + travel) / STEP);
    while (j % len !== target) j++;
    const done = () => {
      setLanded({ id: landOn.id, index: j });
      landedCb.current();
    };
    if (reduce) {
      x.set(centered(j));
      done();
      return;
    }
    const controls = animate(x, centered(j), { duration: fast ? 0.8 : 1.7, ease: [0.1, 0.75, 0.2, 1] });
    controls.then(done);
    return () => controls.stop();
  }, [landOn, width, len, cycle, tiles, reduce, x, fast]);

  const hit = landed && landOn && landed.id === landOn.id ? landed.index : null;
  const strip = Array.from({ length: REPS * len }, (_, j) => tiles[j % len]);
  const blur = spinning && !landOn && !reduce;

  return (
    <div className="relative rounded-[1.75rem] bg-[#3b1d07] p-2 pt-1.5 shadow-[inset_0_2px_0_rgb(255_255_255/0.12),0_10px_24px_rgb(0_0_0/0.35)] ring-2 ring-amber-400/80">
      <div aria-hidden className="flex justify-between px-3 pb-1.5">
        {Array.from({ length: LIGHTS }, (_, i) => (
          <span
            key={i}
            className={cn("size-1.5 rounded-full bg-amber-200 shadow-[0_0_6px_#fcd34d]", spinning && !reduce && "animate-pulse")}
            style={spinning ? { animationDelay: `${(i % 3) * 150}ms`, animationDuration: "450ms" } : undefined}
          />
        ))}
      </div>
      <div className="relative">
        <div
          ref={windowRef}
          className="relative h-[100px] overflow-hidden rounded-[1.25rem] bg-[linear-gradient(180deg,#fffaf0,#fde9b8)] [mask-image:linear-gradient(90deg,transparent,#000_16%,#000_84%,transparent)]"
        >
          <motion.ul aria-hidden style={{ x }} className={cn("absolute inset-y-0 left-0 flex items-center gap-2 transition-[filter]", blur && "blur-[1.5px]")}>
            {strip.map((t, j) => (
              <li
                key={j}
                style={{ width: TILE }}
                className={cn(
                  "flex h-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-white px-1 text-center text-foreground shadow-sm ring-1 ring-black/5 transition-transform duration-300",
                  hit === j && "scale-105 ring-2 ring-amber-400",
                )}
              >
                <RewardGlyph type={t.type} icon={t.icon} rarity={t.rarity} size="md" />
                <span className="text-xs leading-none font-extrabold">{t.short}</span>
                <span className="max-w-full truncate text-[10px] leading-none font-semibold text-muted-foreground tabular">{t.value}</span>
              </li>
            ))}
          </motion.ul>
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-y-0.5 left-1/2 w-[96px] -translate-x-1/2 rounded-[1.25rem] border-[3px] border-amber-400 shadow-[0_0_14px_rgb(251_191_36/0.6)]">
          <span className="absolute -top-[3px] left-1/2 size-0 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent border-t-amber-400" />
          <span className="absolute -bottom-[3px] left-1/2 size-0 -translate-x-1/2 border-x-[7px] border-b-[8px] border-x-transparent border-b-amber-400" />
        </span>
      </div>
    </div>
  );
}
