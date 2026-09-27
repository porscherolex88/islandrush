"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Coins, Loader2 } from "lucide-react";
import Image from "next/image";
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
import { ART } from "./art";
import { OddsSheet } from "./odds-sheet";
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

export type CollectionLookup = Record<string, { collection: string; owned: number; total: number; has: boolean }>;

type CrateState = "idle" | "selected" | "others" | "opening" | "lid" | "opened" | "dimmed";

/** One illustrated crate in the 3 × 3 grid. */
export function MysteryBox({
  index,
  state,
  reward,
  onSelect,
  disabled,
}: {
  index: number;
  state: CrateState;
  reward?: RewardResult | null;
  onSelect: () => void;
  disabled: boolean;
}) {
  const reduce = useReducedMotion();
  const open = state === "lid" || state === "opened";
  const r = rarityOf(reward?.rarity);
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={state === "selected"}
      aria-label={state === "opened" && reward ? `Crate ${index + 1}: ${reward.display}` : `Crate ${index + 1}`}
      className={cn(
        "relative aspect-square rounded-2xl outline-none transition-[opacity,filter] duration-500 focus-visible:ring-4 focus-visible:ring-amber-300/70",
        state === "others" && "opacity-60",
        state === "dimmed" && "opacity-25 grayscale",
      )}
      whileTap={reduce || disabled ? undefined : { scale: 0.92 }}
      animate={
        reduce
          ? undefined
          : state === "opening"
            ? { scale: [1, 1.08, 1.04, 1.1], rotate: [0, -5, 5, -5, 5, -3, 3, 0] }
            : state === "lid"
              ? { scale: 1.14, rotate: 0, y: -4 }
              : state === "selected"
                ? { y: [0, -10, -6], scale: 1.06 }
                : { y: 0, scale: 1, rotate: 0 }
      }
      transition={
        state === "opening"
          ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
          : state === "selected"
            ? { duration: 0.35, ease: "easeOut" }
            : { type: "spring", stiffness: 380, damping: 20 }
      }
    >
      <div className={cn("relative size-full", state === "idle" && !reduce && "animate-bob")} style={{ animationDelay: `${(index % 3) * 0.35 + Math.floor(index / 3) * 0.2}s` }}>
        <Image
          src={open ? ART.crateOpen : ART.crate}
          alt=""
          fill
          sizes="(max-width: 430px) 30vw, 130px"
          className={cn("rounded-2xl object-cover shadow-[0_6px_14px_-4px_rgb(0_0_0/0.5)] transition-shadow", (state === "selected" || state === "opening" || open) && "shadow-glow")}
          draggable={false}
        />
        <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-black/35 text-[11px] font-bold text-white/90">{index + 1}</span>
        <AnimatePresence>
          {state === "opened" && reward && (
            <motion.span
              className={cn("absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-xl bg-white/95 px-1 py-1 text-[11px] font-bold shadow ring-2", r.ring)}
              initial={reduce ? false : { y: 12, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <span aria-hidden>{reward.icon}</span>
              <span className="truncate text-foreground">{reward.display}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

export function MysteryBoxGrid({ boxes, credits, rate, collections }: { boxes: BoxView[]; credits: number; rate: { cash: number; credits: number }; collections: CollectionLookup }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = useState(boxes[0]?.id);
  const box = boxes.find((b) => b.id === activeId) ?? boxes[0];
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"choose" | "opening" | "lid" | "revealed">("choose");
  const [result, setResult] = useState<{ index: number; reward: RewardResult; xp: number } | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [balance, setBalance] = useState(credits);
  const keyRef = useRef<string | null>(null);

  const { run, pending } = useAction(playBoxAction, {
    refresh: false,
    onSuccess: (d) => {
      keyRef.current = null;
      setBalance(Number(d.creditsBalance));
      setResult({ index: d.selectedIndex, reward: d.reward, xp: d.xp });
      setPhase("lid");
      setTimeout(
        () => {
          setPhase("revealed");
          setRevealOpen(true);
        },
        reduce ? 0 : 900,
      );
    },
    onError: () => setPhase("choose"),
  });

  if (!box) return null;
  const affordable = balance >= box.priceCredits;
  const rm = (box.priceCredits * rate.cash) / Math.max(1, rate.credits);

  function open() {
    if (selected === null || !box) return;
    keyRef.current ??= newKey();
    setPhase("opening");
    run({ boxId: box.id, selectedIndex: selected, idempotencyKey: keyRef.current });
  }

  function reset() {
    setRevealOpen(false);
    setSelected(null);
    setResult(null);
    setPhase("choose");
    router.refresh();
  }

  const stateFor = (i: number): CrateState => {
    if (phase === "revealed") return result?.index === i ? "opened" : "dimmed";
    if (phase === "lid") return result?.index === i ? "lid" : "dimmed";
    if (phase === "opening") return selected === i ? "opening" : "dimmed";
    if (selected === null) return "idle";
    return selected === i ? "selected" : "others";
  };

  const col = result?.reward.itemId ? collections[result.reward.itemId] : undefined;
  const note = col ? (
    col.has ? (
      <span>Added to your inventory. You already had this {col.collection} piece.</span>
    ) : (
      <span className="font-semibold text-amber-200">
        Collection progress +1 · {col.collection} {col.owned + 1}/{col.total}
      </span>
    )
  ) : undefined;

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
              className={cn("h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors", b.id === box.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="text-center">
        <p className="font-heading text-2xl font-extrabold">{box.name}</p>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">{box.description}</p>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,oklch(0.45_0.08_205),oklch(0.26_0.05_225)_70%)] p-3 shadow-lift">
        <div aria-hidden className="animate-glow pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="relative grid grid-cols-3 gap-2.5" role="group" aria-label="Nine crates. Choose one.">
          {Array.from({ length: 9 }).map((_, i) => (
            <MysteryBox
              key={`${box.id}-${i}`}
              index={i}
              state={stateFor(i)}
              reward={result?.index === i ? result.reward : null}
              disabled={phase !== "choose" || pending}
              onSelect={() => setSelected(i)}
            />
          ))}
        </div>
      </div>

      <p className="min-h-5 text-center text-sm font-medium text-muted-foreground" aria-live="polite">
        {phase === "choose" && (selected === null ? "Tap a crate to choose it" : `Crate ${selected + 1} chosen. Every crate has the same odds.`)}
        {phase === "opening" && "Opening your crate..."}
        {phase === "lid" && "Something is inside..."}
        {phase === "revealed" && result && (
          <>
            You found <strong className="text-foreground">{result.reward.display}</strong>
          </>
        )}
      </p>

      <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 shadow-card">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Cost per crate</p>
          <p className="flex items-center gap-1.5 font-heading text-xl font-extrabold tabular">
            <Coins className="size-5 text-gold" aria-hidden />
            {formatCredits(box.priceCredits)} Credits
          </p>
        </div>
        <p className="text-right text-sm font-semibold text-muted-foreground tabular">
          ≈ RM{rm.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="block text-[11px] font-normal">
            RM{rate.cash.toLocaleString("en-MY")} = {formatCredits(rate.credits)} Credits
          </span>
        </p>
      </div>

      {phase === "revealed" ? (
        <Button size="xl" variant="gold" className="w-full" onClick={reset}>
          Choose another crate
        </Button>
      ) : affordable ? (
        <Button size="xl" variant="gold" className="w-full" disabled={selected === null || phase !== "choose" || pending} onClick={open}>
          {(pending || phase === "opening" || phase === "lid") && <Loader2 className="animate-spin" />}
          {selected === null ? "Choose a crate first" : `Open crate ${selected + 1}`}
        </Button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-gold/40 bg-gold-soft p-4 text-center">
          <p className="text-sm">
            You need <strong>{formatCredits(box.priceCredits - balance)}</strong> more Credits to open a crate.
          </p>
          <Button asChild size="lg" variant="gold">
            <Link href="/app/wallet/convert">Get Credits</Link>
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground tabular">
        Your Credits: {formatCredits(balance)}
        {box.dailyLimitPerUser ? ` · Up to ${box.dailyLimitPerUser} crates per day` : ""}
      </p>

      <OddsSheet odds={box.odds} description="Every crate has the same odds, no matter which one you pick." />

      <RewardReveal open={revealOpen} onClose={reset} title="You found" rewards={result ? [result.reward] : []} xp={result?.xp} note={note} />
    </div>
  );
}
