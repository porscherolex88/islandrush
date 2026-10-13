"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Box", art: "/illustrations/3d/crate.webp", body: "Pick a Mystery Box for your level and choose one of nine spots. Every box shows its prizes and odds first." },
  { title: "Loot", art: "/illustrations/3d/coins.webp", body: "Each box pays out Loot for that level's map, plus a lucky drop: free Credits, free Cash or a Free unlock that fills your next chest." },
  { title: "Map", art: "/illustrations/3d/map-scroll.webp", body: "Collect enough Loot and the level's illustrated map unlocks. Ten islands, each with its own trail." },
  { title: "Checkpoints", art: "/illustrations/3d/checkpoint.webp", body: "Keep collecting to move from checkpoint to checkpoint until you reach the final destination." },
  { title: "Big Box", art: "/illustrations/3d/big-box.webp", body: "The last checkpoint opens the Big Mystery Box, holding one to three puzzle pieces." },
  { title: "Puzzle", art: "/illustrations/3d/puzzle.webp", body: "Every level has a prize puzzle. Fit the pieces together to complete it." },
  { title: "Prize", art: "/illustrations/3d/prize-gift.webp", body: "A finished puzzle unlocks that level's prize. Then the next island opens up." },
] as const;

/** One step's artwork inside the shared panel. */
function StepArt({ step, sizes, priority }: { step: (typeof STEPS)[number]; sizes: string; priority?: boolean }) {
  return (
    <span className="absolute inset-[14%]">
      <Image src={step.art} alt="" fill sizes={sizes} priority={priority} className="object-contain drop-shadow-[0_24px_30px_rgb(10_11_13/0.18)]" />
    </span>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("relative overflow-hidden", className)}>{children}</div>;
}

function Step({ i, active }: { i: number; active: boolean }) {
  const s = STEPS[i];
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0 sm:gap-5 lg:min-h-[24vh] lg:pb-0">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full border-2 font-heading text-base font-extrabold transition-colors duration-300 sm:size-11 sm:text-lg",
            active ? "border-gold bg-gold text-[var(--gold-ink)]" : "border-border bg-card text-muted-foreground",
          )}
        >
          {i + 1}
        </span>
        {i < STEPS.length - 1 && <span aria-hidden className="mt-2 w-0.5 flex-1 rounded-full bg-[repeating-linear-gradient(to_bottom,var(--border)_0_6px,transparent_6px_12px)]" />}
      </div>
      <div className="min-w-0 flex-1 pt-1 pb-2">
        <h3 className={cn("text-2xl font-extrabold transition-colors duration-300 lg:text-3xl", active ? "text-foreground" : "text-foreground lg:text-muted-foreground")}>{s.title}</h3>
        <p className={cn("mt-1.5 max-w-md text-muted-foreground transition-opacity duration-300 lg:mt-2 lg:text-lg", !active && "lg:opacity-60")}>{s.body}</p>
        <Panel className="mt-4 aspect-[16/10] w-full max-w-md lg:hidden">
          <StepArt step={s} sizes="(min-width: 640px) 448px, 90vw" />
        </Panel>
      </div>
    </li>
  );
}

/** The seven-step loop of every level. On large screens the artwork stays pinned and swaps as each step reaches the middle of the viewport. */
export function LoopJourney() {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const s = STEPS[active];

  // Derived from scroll position rather than per-step visibility, so a fast scroll can never skip a step.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const items = list.current?.children;
      if (!items) return;
      const mid = window.innerHeight / 2;
      let next = 0;
      for (let i = 0; i < items.length; i++) if (items[i].getBoundingClientRect().top <= mid) next = i;
      setActive(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden lg:block">
        <Panel className="sticky top-28 aspect-square">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={s.title}
              className="absolute inset-0"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.05, y: -20 }}
              transition={{ type: "spring", stiffness: 160, damping: 20 }}
            >
              <StepArt step={s} sizes="560px" />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 p-5">
            {STEPS.map((x, i) => (
              <span key={x.title} className={cn("h-1.5 rounded-full transition-all duration-300", i === active ? "w-8 bg-primary" : "w-1.5 bg-border")} />
            ))}
          </div>
        </Panel>
      </div>
      <ol ref={list}>
        {STEPS.map((x, i) => (
          <Step key={x.title} i={i} active={i === active} />
        ))}
      </ol>
    </div>
  );
}
