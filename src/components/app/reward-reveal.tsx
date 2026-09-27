"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
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
  const rays = Array.from({ length: 12 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {rays.map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{ background: i % 3 === 0 ? "#fbbf24" : color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((i / rays.length) * Math.PI * 2) * 120,
            y: Math.sin((i / rays.length) * Math.PI * 2) * 120,
            opacity: 0,
            scale: 0.4,
          }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
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
};

/**
 * Full-screen reward celebration. Animation is decorative only: the result is always
 * rendered as text and announced to assistive technology.
 */
export function RewardReveal({ open, onClose, title = "You found", rewards, xp, note, primaryAction }: Props) {
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
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-background p-6 text-center shadow-lift"
            initial={reduce ? { opacity: 0 } : { scale: 0.85, y: 24, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 h-40 opacity-60" style={{ background: `radial-gradient(circle at 50% 0%, ${rarity.hex}55, transparent 70%)` }} aria-hidden />
            <button
              ref={closeRef}
              onClick={onClose}
              className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <p id="reward-title" className="relative text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {title}
            </p>
            <div className="relative mx-auto my-5 grid size-32 place-items-center">
              {!reduce && top && <Burst color={rarity.hex} />}
              <motion.div
                className={cn("grid size-28 place-items-center rounded-[2rem] text-6xl shadow-xl ring-4", rarity.bg, rarity.ring, rarity.glow)}
                initial={reduce ? false : { rotate: -12, scale: 0.4 }}
                animate={reduce ? undefined : { rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
                aria-hidden
              >
                {top?.icon ?? "✨"}
              </motion.div>
            </div>
            <div aria-live="polite" className="relative space-y-2">
              {top?.headline && <p className="font-heading text-lg font-bold">{top.headline}</p>}
              {rewards.length === 0 && <p className="font-heading text-xl font-bold">Unlocked!</p>}
              {rewards.map((r, i) => (
                <motion.div
                  key={`${r.entryId}-${i}`}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.1 }}
                >
                  <p className="font-heading text-2xl font-extrabold">{r.display}</p>
                  <p className={cn("text-xs font-bold tracking-wider uppercase", rarityOf(r.rarity).text)}>{rarityOf(r.rarity).label}</p>
                </motion.div>
              ))}
              {xp ? <p className="text-sm font-semibold text-primary">+{xp} XP</p> : null}
              {note && <div className="text-sm text-muted-foreground">{note}</div>}
            </div>
            <div className="relative mt-6 grid gap-2">
              {primaryAction && (
                <Button size="xl" onClick={primaryAction.onClick}>
                  {primaryAction.label}
                </Button>
              )}
              <Button size="xl" variant={primaryAction ? "ghost" : "default"} onClick={onClose}>
                {primaryAction ? "Close" : "Awesome"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
