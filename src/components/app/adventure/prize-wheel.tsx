"use client";

import { motion, useReducedMotion } from "motion/react";

const SEGMENTS = 8;
const SEG = 360 / SEGMENTS;

/**
 * Eight equal segments alternating prize and alternative reward. It has no say in the result: the
 * server decides first, then the wheel turns to a matching segment.
 */
export function PrizeWheel({ outcome, onDone }: { outcome: "PRIZE" | "ALTERNATIVE" | null; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const target = outcome === "PRIZE" ? SEG / 2 : outcome === "ALTERNATIVE" ? SEG + SEG / 2 : 0;
  const rotation = outcome ? 360 * 5 - target : 0;

  const arc = (from: number, to: number) => {
    const r = 46;
    const p = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return `${50 + r * Math.cos(rad)} ${50 + r * Math.sin(rad)}`;
    };
    return `M 50 50 L ${p(from)} A ${r} ${r} 0 0 1 ${p(to)} Z`;
  };
  const labelAt = (deg: number, dist = 30) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 50 + dist * Math.cos(rad), y: 50 + dist * Math.sin(rad) };
  };

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
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const prize = i % 2 === 0;
          const mid = labelAt(i * SEG + SEG / 2);
          return (
            <g key={i}>
              <path d={arc(i * SEG, (i + 1) * SEG)} style={{ fill: prize ? "var(--gold)" : "var(--ocean)" }} />
              <text
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${i * SEG + SEG / 2} ${mid.x} ${mid.y})`}
                className={prize ? "fill-amber-950 font-heading text-[5.5px] font-extrabold" : "fill-white text-[4.5px] font-bold"}
              >
                {prize ? "Prize" : "Bonus"}
              </text>
            </g>
          );
        })}
        <circle cx="50" cy="50" r="9" fill="white" style={{ stroke: "var(--ocean-deep)" }} strokeWidth="2" />
      </motion.svg>
    </div>
  );
}
