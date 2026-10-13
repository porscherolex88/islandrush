"use client";

import { Check, Coins, Flame, Gift, Star } from "lucide-react";
import { animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TONES = [
  { fill: "var(--ocean-deep)", ink: "white" },
  { fill: "var(--gold)", ink: "var(--gold-ink)" },
  { fill: "var(--ocean)", ink: "white" },
  { fill: "var(--gold-soft)", ink: "var(--gold-foreground)" },
];
const SEGMENTS = [Coins, Star, Gift, Coins, Star, Gift, Coins, Star].map((Icon, i) => ({ Icon, ...TONES[i % TONES.length] }));

/** Rounded so server and client serialise identical SVG attributes. */
const r2 = (v: number) => Math.round(v * 100) / 100;

function slice(i: number, n: number, r: number) {
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
  return `M0 0 L${r2(Math.cos(a0) * r)} ${r2(Math.sin(a0) * r)} A${r} ${r} 0 0 1 ${r2(Math.cos(a1) * r)} ${r2(Math.sin(a1) * r)} Z`;
}

function SpinWheel() {
  const rotate = useMotionValue(0);
  const [spinning, setSpinning] = useState(false);
  const [spun, setSpun] = useState(false);
  const reduced = useReducedMotion();
  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const target = rotate.get() + 360 * (reduced ? 1 : 5) + Math.floor(Math.random() * 8) * 45 + 22.5;
    animate(rotate, target, {
      duration: reduced ? 0.3 : 3.6,
      ease: [0.12, 0.8, 0.18, 1],
      onComplete: () => {
        setSpinning(false);
        setSpun(true);
      },
    });
  };
  const n = SEGMENTS.length;
  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-square w-full max-w-[300px]">
        <div aria-hidden className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[24px] border-x-transparent border-t-gold drop-shadow" />
        <motion.svg viewBox="-110 -110 220 220" className="size-full drop-shadow-[0_20px_30px_rgb(10_11_13/0.25)]" style={{ rotate }} aria-hidden>
          <circle r="108" style={{ fill: "var(--gold-lo)" }} />
          {SEGMENTS.map((s, i) => (
            <path key={i} d={slice(i, n, 96)} style={{ fill: s.fill, stroke: "var(--gold-hi)" }} strokeWidth="1.5" />
          ))}
          {SEGMENTS.map((s, i) => {
            const a = ((i + 0.5) / n) * 360 - 90;
            const rad = (a * Math.PI) / 180;
            return (
              <g key={`i${i}`} transform={`translate(${r2(Math.cos(rad) * 62)} ${r2(Math.sin(rad) * 62)}) rotate(${r2(a + 90)})`}>
                <s.Icon x={-11} y={-11} width={22} height={22} style={{ color: s.ink }} strokeWidth={2.2} />
              </g>
            );
          })}
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return <circle key={`b${i}`} cx={r2(Math.cos(a) * 102)} cy={r2(Math.sin(a) * 102)} r="3" style={{ fill: "var(--warm-soft)" }} />;
          })}
          <circle r="16" style={{ fill: "var(--gold)", stroke: "var(--gold-foreground)" }} strokeWidth="3" />
        </motion.svg>
      </div>
      <Button variant="gold" size="xl" className="mt-6 rounded-full" onClick={spin} disabled={spinning}>
        {spinning ? "Spinning..." : spun ? "Spin again" : "Try a practice spin"}
      </Button>
      <p className="mt-3 h-5 text-center text-sm text-muted-foreground" aria-live="polite">
        {spun && !spinning ? (
          <>
            Practice only. <Link href="/register" className="font-semibold text-primary underline-offset-2 hover:underline">Your real free spin is waiting</Link>.
          </>
        ) : (
          "Practice spins are just for fun and never pay out."
        )}
      </p>
    </div>
  );
}

const REWARD_DAYS = [3, 7];
const DEMO_DONE = 5;

function StreakStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <div ref={ref} className="rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold">Check in, build a streak</h3>
        <span className="flex items-center gap-1 text-sm font-bold text-primary">
          <Flame className="size-4" aria-hidden /> Day {DEMO_DONE}
        </span>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="A 7-day streak week with rewards on day 3 and day 7">
        {Array.from({ length: 7 }, (_, i) => {
          const day = i + 1;
          const reward = REWARD_DAYS.includes(day);
          const done = day <= DEMO_DONE;
          const isToday = day === DEMO_DONE + 1;
          return (
            <li key={day} aria-hidden className="flex flex-col items-center gap-1.5">
              <motion.span
                className={cn(
                  "relative grid aspect-square w-full max-w-12 place-items-center rounded-full",
                  done ? "bg-gold text-[var(--gold-ink)]" : "border-2 border-dashed border-border bg-muted/50 text-muted-foreground",
                  isToday && "border-solid border-primary text-primary",
                  reward && !done && "border-solid border-primary bg-brand-soft text-primary",
                )}
                initial={false}
                animate={inView && done ? { scale: [1, 1.2, 1] } : undefined}
                transition={{ delay: i * 0.12, duration: 0.35 }}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : reward ? <Gift className="size-4" /> : <Flame className="size-4" />}
                {reward && done && (
                  <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-card text-primary ring-2 ring-card">
                    <Gift className="size-2.5" />
                  </span>
                )}
              </motion.span>
              <span className={cn("text-[11px] font-bold tabular", isToday ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")}>
                {isToday ? "Today" : `Day ${day}`}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-muted-foreground">Rewards land on day 3 and day 7. Then a new week starts and you can earn them again.</p>
    </div>
  );
}

const MISSIONS = ["Check in today", "Open 1 Mystery Box", "Complete Daily Spin"];

function MissionList() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [ticked, setTicked] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const ids = MISSIONS.map((_, i) => setTimeout(() => setTicked(i + 1), 500 + i * 650));
    return () => ids.forEach(clearTimeout);
  }, [inView]);
  return (
    <div ref={ref} className="rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold">Three missions a day</h3>
        <span className="text-sm font-bold text-primary tabular">{ticked}/3</span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {MISSIONS.map((m, i) => {
          const done = i < ticked;
          return (
            <li key={m} className="flex items-center gap-3">
              <span className={cn("grid size-6 place-items-center rounded-full border-2 transition-colors duration-300", done ? "border-success bg-success text-white" : "border-border")}>
                {done && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </motion.span>
                )}
              </span>
              <span className={cn("text-sm transition-colors", done ? "text-muted-foreground line-through" : "font-medium")}>{m}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">Finish all three for a bonus reward. New missions every day.</p>
    </div>
  );
}

export function DailyTeaser() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
      <SpinWheel />
      <div className="grid gap-4">
        <StreakStrip />
        <MissionList />
      </div>
    </div>
  );
}
