"use client";

import { motion, useReducedMotion } from "motion/react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The jackpot meter: a fuse of fire that creeps along with every play and ends in a bonfire.
 * When it reaches the end the box spins for free `spins` times.
 */
export function JackpotFire({ plays, target, spins, blazing = false, className }: { plays: number; target: number; spins: number; blazing?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const pct = target > 0 ? Math.min(100, (plays / target) * 100) : 0;
  const hot = blazing || pct >= 80;
  const flicker = reduce ? undefined : { scale: [1, 1.18, 0.94, 1.1, 1], rotate: [-4, 5, -3, 4, -4] };

  return (
    <div className={cn("flex items-center gap-2", className)} role="meter" aria-label="Jackpot" aria-valuemin={0} aria-valuemax={target} aria-valuenow={plays} aria-valuetext={blazing ? "Jackpot" : `${plays} of ${target} plays to the jackpot`}>
      <div className="relative h-3.5 flex-1 rounded-full bg-black/35 ring-1 ring-orange-300/30">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#fde68a,#fb923c_45%,#ef4444)] shadow-[0_0_10px_rgb(251_146_60/0.7)]"
          initial={false}
          animate={{ width: `${blazing ? 100 : pct}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        />
        {(pct > 0 || blazing) && (
          <motion.span
            aria-hidden
            className="absolute top-1/2 -translate-x-1/2 -translate-y-[62%] text-orange-300 drop-shadow-[0_0_6px_#f97316]"
            initial={false}
            animate={{ left: `${blazing ? 100 : pct}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          >
            <motion.span className="block" animate={flicker} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}>
              <Flame className="size-5 fill-amber-300" />
            </motion.span>
          </motion.span>
        )}
      </div>
      <div className={cn("relative grid size-11 shrink-0 place-items-center rounded-2xl bg-black/30 ring-2", hot ? "ring-orange-400 shadow-[0_0_18px_rgb(249_115_22/0.75)]" : "ring-orange-300/40")}>
        <motion.span aria-hidden animate={hot ? flicker : undefined} transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}>
          <Flame className={cn("size-6", hot ? "fill-orange-400 text-amber-200" : "fill-orange-500/40 text-orange-300")} />
        </motion.span>
        <span className="absolute -bottom-1.5 rounded-full bg-orange-500 px-1.5 text-[10px] leading-4 font-extrabold text-white tabular">{blazing ? "Jackpot" : `${spins}x`}</span>
      </div>
      <p className="w-14 shrink-0 text-right text-[11px] leading-tight font-bold text-white/85 tabular">
        {blazing ? "Free spins!" : (
          <>
            {plays}/{target}
            <span className="block font-semibold text-white/60">to jackpot</span>
          </>
        )}
      </p>
    </div>
  );
}
