"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Art with its own painted background is shown as a rounded card; cut-outs float freely. */
const CARD_ART = new Set(["Box", "Checkpoints", "Big Box"]);

const STEPS = [
  { title: "Box", art: "/illustrations/crate.webp", body: "Pick a Mystery Box for your level and choose one of nine spots. Every box shows its prizes and odds first." },
  { title: "Loot", art: "/illustrations/3d/coins.webp", body: "Each box pays out Loot for that level's map, plus a bonus reward like Credits or a collectible item." },
  { title: "Map", art: "/illustrations/3d/map-scroll.webp", body: "Collect enough Loot and the level's illustrated map unlocks. Ten islands, each with its own trail." },
  { title: "Checkpoints", art: "/illustrations/adventure/map-3.webp", body: "Keep collecting to move from checkpoint to checkpoint until you reach the final destination." },
  { title: "Big Box", art: "/illustrations/adventure/big-box.webp", body: "The last checkpoint opens the Big Mystery Box, holding one to three puzzle pieces." },
  { title: "Puzzle", art: "/illustrations/3d/puzzle.webp", body: "Every level has a prize puzzle. Fit the pieces together to complete it." },
  { title: "Prize", art: "/illustrations/3d/gift.webp", body: "A finished puzzle unlocks that level's prize. Then the next island opens up." },
] as const;

function Step({ i, active, onActive }: { i: number; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  const s = STEPS[i];
  return (
    <li ref={ref} className="relative flex gap-5 pb-10 last:pb-0 lg:min-h-[24vh] lg:pb-0">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full border-2 font-heading text-lg font-extrabold transition-colors duration-300",
            active ? "border-gold bg-gold text-[oklch(0.3_0.08_55)]" : "border-border bg-card text-muted-foreground",
          )}
        >
          {i + 1}
        </span>
        {i < STEPS.length - 1 && <span aria-hidden className="mt-2 w-0.5 flex-1 rounded-full bg-[repeating-linear-gradient(to_bottom,var(--border)_0_6px,transparent_6px_12px)]" />}
      </div>
      <div className="pt-1.5 pb-2">
        <h3 className={cn("text-2xl font-extrabold transition-colors duration-300 lg:text-3xl", active ? "text-foreground" : "text-muted-foreground")}>{s.title}</h3>
        <p className={cn("mt-2 max-w-md text-muted-foreground transition-opacity duration-300 lg:text-lg", !active && "lg:opacity-60")}>{s.body}</p>
        <div className="relative mt-4 h-40 w-full max-w-xs lg:hidden">
          <Image src={s.art} alt="" fill sizes="320px" className={cn("rounded-2xl", CARD_ART.has(s.title) ? "object-cover" : "object-contain")} />
        </div>
      </div>
    </li>
  );
}

/** The seven-step loop of every level. On large screens the artwork stays pinned and swaps as each step reaches the middle of the viewport. */
export function LoopJourney() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const s = STEPS[active];
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden lg:block">
        <div className="sticky top-28 aspect-square overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_60%,oklch(0.42_0.08_215),var(--ocean-deep)_75%)]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={s.title}
              className="absolute inset-[10%]"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, rotate: -8, y: 40 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.1, y: -30 }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
            >
              <Image src={s.art} alt="" fill sizes="480px" className={cn("object-contain drop-shadow-[0_24px_30px_rgb(0_0_0/0.45)]", CARD_ART.has(s.title) && "rounded-3xl object-cover shadow-2xl ring-1 ring-white/10")} />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 p-5">
            {STEPS.map((x, i) => (
              <span key={x.title} className={cn("h-1.5 rounded-full transition-all duration-300", i === active ? "w-8 bg-gold" : "w-1.5 bg-white/35")} />
            ))}
          </div>
        </div>
      </div>
      <ol>
        {STEPS.map((x, i) => (
          <Step key={x.title} i={i} active={i === active} onActive={setActive} />
        ))}
      </ol>
    </div>
  );
}
