"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Two-segment wheel drawn to the configured odds. It has no say in the result: the server
 * decides first, then the wheel turns to the matching segment.
 */
export function PrizeWheel({ prizePct, outcome, onDone }: { prizePct: number; outcome: "PRIZE" | "ALTERNATIVE" | null; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const prizeDeg = (prizePct / 100) * 360;
  const target = outcome === "PRIZE" ? prizeDeg / 2 : outcome === "ALTERNATIVE" ? prizeDeg + (360 - prizeDeg) / 2 : 0;
  const rotation = outcome ? 360 * 5 - target : 0;

  const arc = (from: number, to: number) => {
    const r = 46;
    const p = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return `${50 + r * Math.cos(rad)} ${50 + r * Math.sin(rad)}`;
    };
    if (to - from >= 360) return `M 50 4 A ${r} ${r} 0 1 1 49.99 4 Z`;
    return `M 50 50 L ${p(from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)} Z`;
  };
  const labelAt = (deg: number, dist = 28) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 50 + dist * Math.cos(rad), y: 50 + dist * Math.sin(rad) };
  };
  const prizeLabel = labelAt(prizeDeg / 2);
  const altLabel = labelAt(prizeDeg + (360 - prizeDeg) / 2);

  return (
    <div className="relative mx-auto aspect-square w-64">
      <svg viewBox="0 0 100 100" className="absolute -top-1 left-1/2 z-10 h-7 w-7 -translate-x-1/2" aria-hidden>
        <path d="M50 92 L22 30 Q50 10 78 30 Z" fill="white" style={{ stroke: "var(--ocean-deep)" }} strokeWidth="6" strokeLinejoin="round" />
      </svg>
      <motion.svg
        viewBox="0 0 100 100"
        className="size-full drop-shadow-lg"
        initial={false}
        animate={{ rotate: rotation }}
        transition={reduce ? { duration: 0 } : { duration: 4, ease: [0.12, 0.7, 0.18, 1] }}
        onAnimationComplete={() => outcome && onDone?.()}
        aria-hidden
      >
        <circle cx="50" cy="50" r="49" style={{ fill: "var(--ocean-deep)" }} />
        {prizePct > 0 && <path d={arc(0, prizeDeg)} style={{ fill: "var(--gold)" }} />}
        {prizePct < 100 && <path d={arc(prizeDeg, 360)} style={{ fill: "var(--ocean)" }} />}
        {prizePct > 0 && (
          <text x={prizeLabel.x} y={prizeLabel.y} textAnchor="middle" dominantBaseline="middle" className="fill-amber-950 font-heading text-[7px] font-extrabold">
            Prize
          </text>
        )}
        {prizePct > 0 && prizePct < 100 && (
          <text x={altLabel.x} y={altLabel.y} textAnchor="middle" dominantBaseline="middle" className="fill-white text-[5px] font-bold">
            Alternative
          </text>
        )}
        <circle cx="50" cy="50" r="9" fill="white" style={{ stroke: "var(--ocean-deep)" }} strokeWidth="2" />
      </motion.svg>
    </div>
  );
}
