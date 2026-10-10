"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { RARITY, type RarityKey } from "@/lib/rarity";

const EXAMPLE: [RarityKey, number][] = [
  ["COMMON", 55],
  ["UNCOMMON", 25],
  ["RARE", 12],
  ["EPIC", 6],
  ["LEGENDARY", 2],
];

/** Illustrative odds breakdown in the same shape every Mystery Box shows before you play. */
export function OddsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <div ref={ref} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="flex items-baseline justify-between">
        <p className="font-heading text-lg font-extrabold">Odds, before you open</p>
        <p className="text-xs text-white/55">Example box</p>
      </div>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-white/10">
        {EXAMPLE.map(([k, pct], i) => (
          <motion.span
            key={k}
            className="h-full origin-left"
            style={{ width: `${pct}%`, backgroundColor: RARITY[k].hex }}
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : undefined}
            transition={{ delay: 0.15 + i * 0.18, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        {EXAMPLE.map(([k, pct]) => (
          <li key={k} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: RARITY[k].hex }} />
            <span className="text-white/80">{RARITY[k].label}</span>
            <span className="ml-auto font-semibold tabular sm:ml-0">{pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
