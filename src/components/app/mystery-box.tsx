"use client";

import { motion, useReducedMotion } from "motion/react";
import { Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { newKey, useAction } from "@/hooks/use-action";
import { formatCredits } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { playBoxAction } from "@/server/actions/games";
import type { PoolOdds } from "@/server/services/mystery-box";
import type { RewardResult } from "@/server/services/rewards";
import { RewardReveal } from "./reward-reveal";

export type BoxView = {
  id: string;
  name: string;
  description: string;
  priceCredits: number;
  theme: { color: string; accent: string };
  odds: PoolOdds;
  dailyLimitPerUser: number | null;
};

/** A single closed/opened mystery box tile. */
export function MysteryBox({
  index,
  theme,
  state,
  reward,
  onSelect,
  disabled,
}: {
  index: number;
  theme: { color: string; accent: string };
  state: "idle" | "selected" | "opening" | "opened" | "dimmed";
  reward?: RewardResult | null;
  onSelect: () => void;
  disabled: boolean;
}) {
  const reduce = useReducedMotion();
  const r = rarityOf(reward?.rarity);
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={state === "selected"}
      aria-label={state === "opened" && reward ? `Box ${index + 1}: ${reward.display}` : `Box ${index + 1}`}
      className={cn(
        "relative aspect-square rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        state === "dimmed" && "opacity-40",
      )}
      whileTap={reduce || disabled ? undefined : { scale: 0.94 }}
      animate={
        reduce
          ? undefined
          : state === "opening"
            ? { rotate: [0, -6, 6, -6, 6, 0], scale: [1, 1.05, 1.05, 1.08, 1.08, 1.1] }
            : state === "selected"
              ? { y: -4, scale: 1.04 }
              : { y: 0, scale: 1, rotate: 0 }
      }
      transition={state === "opening" ? { duration: 0.9, repeat: Infinity } : { type: "spring", stiffness: 400, damping: 22 }}
    >
      {state === "opened" && reward ? (
        <motion.div
          className={cn("grid size-full place-items-center rounded-2xl text-4xl ring-4", r.bg, r.ring)}
          initial={reduce ? false : { rotateY: 90, scale: 0.8 }}
          animate={{ rotateY: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <span aria-hidden>{reward.icon}</span>
        </motion.div>
      ) : (
        <div
          className={cn(
            "relative size-full overflow-hidden rounded-2xl shadow-card transition-shadow",
            state === "selected" && "shadow-lift ring-4 ring-gold",
          )}
          style={{ background: `linear-gradient(145deg, ${theme.color}, color-mix(in oklch, ${theme.color}, black 25%))` }}
        >
          <div className="absolute inset-x-0 top-[34%] h-[14%] bg-black/15" aria-hidden />
          <div className="absolute inset-y-0 left-1/2 w-[16%] -translate-x-1/2" style={{ background: theme.accent }} aria-hidden />
          <div className="absolute top-[26%] left-1/2 grid size-[30%] -translate-x-1/2 place-items-center rounded-full border-2 border-white/70 text-lg font-black text-white" style={{ background: theme.accent }} aria-hidden>
            ?
          </div>
          <div className="shimmer absolute inset-0 opacity-40" aria-hidden />
          <span className="absolute right-2 bottom-1.5 text-[10px] font-bold text-white/70">{index + 1}</span>
        </div>
      )}
    </motion.button>
  );
}

export function MysteryBoxGrid({ boxes, credits }: { boxes: BoxView[]; credits: number }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(boxes[0]?.id);
  const box = boxes.find((b) => b.id === activeId) ?? boxes[0];
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"choose" | "opening" | "revealed">("choose");
  const [result, setResult] = useState<{ index: number; reward: RewardResult; xp: number; balance: number } | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [balance, setBalance] = useState(credits);
  const keyRef = useRef<string | null>(null);

  const { run, pending } = useAction(playBoxAction, {
    refresh: false,
    onSuccess: (d) => {
      keyRef.current = null;
      const bal = Number(d.creditsBalance);
      setBalance(bal);
      setResult({ index: d.selectedIndex, reward: d.reward, xp: d.xp, balance: bal });
      setTimeout(() => {
        setPhase("revealed");
        setRevealOpen(true);
      }, 700);
    },
    onError: () => setPhase("choose"),
  });

  if (!box) return null;
  const affordable = balance >= box.priceCredits;

  function open() {
    if (selected === null || !box) return;
    keyRef.current ??= newKey();
    setPhase("opening");
    run({ boxId: box.id, selectedIndex: selected, idempotencyKey: keyRef.current });
  }

  function reset() {
    setSelected(null);
    setResult(null);
    setPhase("choose");
    router.refresh();
  }

  const stateFor = (i: number): "idle" | "selected" | "opening" | "opened" | "dimmed" => {
    if (phase === "revealed") return result?.index === i ? "opened" : "dimmed";
    if (phase === "opening") return selected === i ? "opening" : "dimmed";
    return selected === i ? "selected" : "idle";
  };

  return (
    <div className="space-y-4">
      {boxes.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Choose a Mystery Box">
          {boxes.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={b.id === box.id}
              disabled={phase !== "choose"}
              onClick={() => {
                setActiveId(b.id);
                setSelected(null);
              }}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                b.id === box.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {b.name} · {formatCredits(b.priceCredits)}
            </button>
          ))}
        </div>
      )}

      <div className="text-center">
        <p className="font-heading text-xl font-bold">{box.name}</p>
        <p className="text-sm text-muted-foreground">{box.description}</p>
      </div>

      <div className="rounded-3xl bg-surface p-3">
        <div className="grid grid-cols-3 gap-3" role="group" aria-label="Nine mystery boxes. Choose one.">
          {Array.from({ length: 9 }).map((_, i) => (
            <MysteryBox
              key={`${box.id}-${i}`}
              index={i}
              theme={box.theme}
              state={stateFor(i)}
              reward={result?.index === i ? result.reward : null}
              disabled={phase !== "choose" || pending}
              onSelect={() => setSelected(i)}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {phase === "choose" && (selected === null ? "Tap a box to choose it" : `Box ${selected + 1} selected`)}
        {phase === "opening" && "Opening your box..."}
        {phase === "revealed" && result && (
          <>
            You found <strong className="text-foreground">{result.reward.display}</strong>
          </>
        )}
      </p>

      {phase === "revealed" ? (
        <Button size="xl" className="w-full" onClick={reset}>
          <RotateCcw /> Play again
        </Button>
      ) : affordable ? (
        <Button size="xl" className="w-full" disabled={selected === null || phase !== "choose" || pending} onClick={open}>
          {(pending || phase === "opening") && <Loader2 className="animate-spin" />}
          {selected === null ? "Choose a box" : `Open for ${formatCredits(box.priceCredits)} Credits`}
        </Button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-gold/40 bg-gold-soft p-4 text-center">
          <p className="text-sm">
            You need <strong>{formatCredits(box.priceCredits - balance)}</strong> more Credits to open this box.
          </p>
          <Button asChild size="lg" variant="gold">
            <Link href="/app/wallet/convert">Get Credits</Link>
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground tabular">
        Balance: {formatCredits(balance)} Credits{box.dailyLimitPerUser ? ` · Limit ${box.dailyLimitPerUser} opens per day` : ""}
      </p>

      <details className="rounded-2xl border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Prizes and odds</summary>
        <ul className="divide-y border-t text-sm">
          {box.odds.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 px-4 py-2">
              <span className="flex items-center gap-2">
                <span aria-hidden>{o.icon}</span>
                {o.label}
              </span>
              <span className={cn("text-xs font-semibold", rarityOf(o.rarity).text)}>
                {rarityOf(o.rarity).label} · {o.pct.toFixed(o.pct < 1 ? 2 : 1)}%
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Results are decided securely on our servers when you open a box. Every box has the same odds regardless of which one you pick.
        </p>
      </details>

      <RewardReveal
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        title={`Box ${result ? result.index + 1 : ""} revealed`}
        rewards={result ? [result.reward] : []}
        xp={result?.xp}
        primaryAction={{
          label: "Play again",
          onClick: () => {
            setRevealOpen(false);
            reset();
          },
        }}
      />
    </div>
  );
}
