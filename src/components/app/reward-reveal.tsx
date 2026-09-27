"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { RewardResult } from "@/server/services/rewards";

export function RewardChip({ reward, className }: { reward: RewardResult; className?: string }) {
  const r = rarityOf(reward.rarity);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", r.bg, r.text, r.ring, className)}>
      <span aria-hidden>{reward.icon}</span>
      {reward.display}
    </span>
  );
}

function Burst({ color }: { color: string }) {
  const rays = Array.from({ length: 16 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {rays.map((_, i) => (
        <motion.span
          key={i}
          className="absolute size-2 rounded-full"
          style={{ background: i % 3 === 0 ? "#fde68a" : color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((i / rays.length) * Math.PI * 2) * 140,
            y: Math.sin((i / rays.length) * Math.PI * 2) * 140,
            opacity: 0,
            scale: 0.3,
          }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      ))}
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  rewards: RewardResult[];
  xp?: number;
  note?: ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  /** Label for the main dismiss button when there is no primary action. */
  collectLabel?: string;
};

/**
 * Full-screen reward celebration. Animation is decorative only: the result is always
 * rendered as text and announced to assistive technology.
 */
export function RewardReveal({ open, onClose, title = "You found", rewards, xp, note, primaryAction, collectLabel = "Collect reward" }: Props) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const top = rewards.reduce<RewardResult | null>((best, r) => {
    const order = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
    return !best || order.indexOf(r.rarity) > order.indexOf(best.rarity) ? r : best;
  }, null);
  const rarity = rarityOf(top?.rarity);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reward-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ocean-deep/70 p-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_30%,oklch(0.42_0.08_215),oklch(0.24_0.05_228))] p-6 text-center text-white shadow-lift ring-1 ring-white/10"
            initial={reduce ? { opacity: 0 } : { scale: 0.8, y: 30, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              aria-hidden
              className="absolute top-[-30%] left-1/2 size-[140%] -translate-x-1/2 opacity-40"
              style={{ background: `repeating-conic-gradient(from 0deg, ${rarity.hex}66 0deg 10deg, transparent 10deg 24deg)`, maskImage: "radial-gradient(circle, black 20%, transparent 60%)" }}
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            />
            <button
              ref={closeRef}
              onClick={onClose}
              className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-white/70 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <p id="reward-title" className="relative flex items-center justify-center gap-1.5 text-sm font-bold tracking-[0.2em] text-amber-200 uppercase">
              <Sparkles className="size-4" aria-hidden />
              {title}
            </p>
            <div className="relative mx-auto my-5 grid size-36 place-items-center">
              {!reduce && top && <Burst color={rarity.hex} />}
              <motion.div
                className={cn("grid size-32 place-items-center rounded-[2.25rem] bg-white/95 text-7xl shadow-2xl ring-4", rarity.ring)}
                style={{ boxShadow: `0 0 50px 6px ${rarity.hex}88` }}
                initial={reduce ? false : { rotate: -14, scale: 0.3 }}
                animate={reduce ? undefined : { rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 13, delay: 0.05 }}
                aria-hidden
              >
                {top?.icon ?? "✨"}
              </motion.div>
            </div>
            <div aria-live="polite" className="relative space-y-1">
              {top?.headline && <p className="font-heading text-lg font-bold">{top.headline}</p>}
              {rewards.length === 0 && <p className="font-heading text-3xl font-extrabold">Unlocked!</p>}
              {rewards.map((r, i) => (
                <motion.div
                  key={`${r.entryId}-${i}`}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <p className={cn("font-heading font-extrabold", i === 0 ? "text-4xl" : "text-2xl")}>{r.display}</p>
                  <p className="text-sm font-bold tracking-wider uppercase" style={{ color: rarityOf(r.rarity).hex === "#64748b" ? "#cbd5e1" : rarityOf(r.rarity).hex }}>
                    {rarityOf(r.rarity).label} Reward
                  </p>
                </motion.div>
              ))}
              {xp ? (
                <motion.p initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="mx-auto mt-2 w-fit rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
                  +{xp} XP
                </motion.p>
              ) : null}
              {note && <div className="pt-2 text-sm text-white/80">{note}</div>}
            </div>
            <div className="relative mt-6 grid gap-2">
              {primaryAction && (
                <Button size="xl" variant="gold" onClick={primaryAction.onClick}>
                  {primaryAction.label}
                </Button>
              )}
              <Button size="xl" variant={primaryAction ? "ghost" : "gold"} className={cn(primaryAction && "text-white hover:bg-white/10 hover:text-white")} onClick={onClose}>
                {primaryAction ? "Close" : collectLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
