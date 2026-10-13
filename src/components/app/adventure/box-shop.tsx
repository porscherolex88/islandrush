"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle2, Coins, Loader2, Lock, Map as MapIcon, Sparkles, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { newKey, useAction } from "@/hooks/use-action";
import { cashMinorToCredits, formatCredits, toDecimal } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { openBoxAction } from "@/server/actions/games";
import type { AdventureBoxView, AdventureMapView } from "@/server/services/adventure";
import type { BoxPlayResult, PoolOdds } from "@/server/services/mystery-box";
import { ART } from "../art";
import { LootMeter, LootToken } from "./loot";
import { BoxOddsSheet, RewardGlyph, useOddLabel } from "./odds";

function qty(amount: string) {
  return Math.max(1, Math.floor(Number(amount) || 1));
}

function lootIn(result: BoxPlayResult) {
  return result.loot.reduce((s, l) => s + (l.type === "ITEM" ? qty(l.amount) : 0), 0);
}

export function BoxShop({
  box,
  map,
  credits,
  cashMinor,
  rate,
  odds,
  enabled,
  nextHref,
}: {
  box: AdventureBoxView;
  map: AdventureMapView | null;
  credits: number;
  /** Cash Wallet balance in minor units, used to decide whether "Get Credits" converts or deposits. */
  cashMinor: string;
  rate: { cashMinor: string; credits: number };
  odds: { rewards: PoolOdds; loot: PoolOdds };
  enabled: boolean;
  nextHref: string | null;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const label = useOddLabel();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "opening" | "revealed">("idle");
  const [result, setResult] = useState<BoxPlayResult | null>(null);
  const [balance, setBalance] = useState(credits);
  const keyRef = useRef<string | null>(null);
  const startedAt = useRef(0);
  // The server count only updates on refresh, so back-to-back opens track Loot locally.
  const [localLoot, setLocalLoot] = useState(map?.lootCollected ?? 0);
  const [lootAtOpen, setLootAtOpen] = useState(0);
  const openBase = useRef(0);
  const knownLoot = Math.max(map?.lootCollected ?? 0, localLoot);

  const { run, pending } = useAction(openBoxAction, {
    refresh: false,
    onSuccess: (d) => {
      keyRef.current = null;
      setBalance(Number(d.creditsBalance));
      setLocalLoot(openBase.current + lootIn(d));
      setResult(d);
      const wait = reduce ? 0 : Math.max(0, 1100 - (Date.now() - startedAt.current));
      setTimeout(() => setPhase("revealed"), wait);
    },
    onError: () => setPhase("idle"),
  });

  const affordable = balance >= box.priceCredits;
  const shortfall = Math.max(0, box.priceCredits - balance);
  const rateCash = BigInt(rate.cashMinor);
  const rateCredits = BigInt(rate.credits);
  let cashNeeded = rateCredits > 0n ? (BigInt(shortfall) * rateCash + rateCredits - 1n) / rateCredits : 0n;
  if (rateCash > 0n && cashMinorToCredits(cashNeeded, rateCash, rateCredits) < BigInt(shortfall)) cashNeeded += 1n;
  const canConvert = cashNeeded > 0n && cashNeeded <= BigInt(cashMinor);
  const getCreditsHref = canConvert ? `/wallet/convert?amount=${toDecimal(cashNeeded)}` : "/wallet/deposit";
  const art = box.artwork ?? ART.crate;
  const lootGained = result ? lootIn(result) : 0;
  const lootBefore = phase === "idle" ? knownLoot : lootAtOpen;
  const lootNow = lootBefore + (phase === "revealed" ? lootGained : 0);
  const target = map ? (map.state === "exploring" ? map.nextLootTarget : map.lootRequired) : 0;
  const readyCp = phase === "idle" && map?.state === "exploring" ? (map.checkpoints.find((c) => c.state === "available") ?? null) : null;
  const mapReadyNow = map && map.state === "collecting" && lootBefore + lootGained >= map.lootRequired;

  function confirm() {
    keyRef.current ??= newKey();
    openBase.current = knownLoot;
    setLootAtOpen(knownLoot);
    setConfirmOpen(false);
    setPhase("opening");
    startedAt.current = Date.now();
    run({ boxId: box.id, idempotencyKey: keyRef.current });
  }

  function close() {
    setPhase("idle");
    setResult(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="relative isolate overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_15%,var(--ocean),var(--ocean-deep)_75%)] px-5 pt-5 pb-6 text-center text-white">
        <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-amber-200/20 blur-3xl" />
        <p className="text-xs font-bold tracking-wide text-amber-200 uppercase">{map?.name ?? `Adventure Level ${box.level}`}</p>
        <h2 className="font-heading text-2xl font-extrabold">{box.name}</h2>
        <motion.div
          className="relative mx-auto mt-3 aspect-square w-44"
          animate={phase === "opening" && !reduce ? { rotate: [0, -4, 4, -4, 4, -2, 2, 0], scale: [1, 1.04, 1.02, 1.06] } : { rotate: 0, scale: 1 }}
          transition={phase === "opening" ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 300, damping: 20 }}
        >
          <Image
            src={phase === "revealed" ? ART.crateOpen : art}
            alt=""
            fill
            sizes="176px"
            priority
            unoptimized={/^https?:/.test(art)}
            className={cn("rounded-3xl object-cover shadow-2xl", box.locked && "opacity-50 grayscale")}
          />
          {box.locked && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-black/55 ring-2 ring-white/30">
                <Lock className="size-6" aria-hidden />
              </span>
            </span>
          )}
        </motion.div>
        <p className="mx-auto mt-3 max-w-xs text-sm text-white/80">{box.description}</p>
        {map && map.lootItems.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white/10 p-3 text-left ring-1 ring-white/10">
            <p className="text-xs font-bold text-amber-200">Inside every box</p>
            <div className="mt-2 flex items-center gap-2">
              {map.lootItems.map((it) => (
                <LootToken key={it.id} icon={it.icon} rarity={it.rarity} size="sm" className="bg-white/90" />
              ))}
              <span className="text-sm leading-tight text-white/85">
                {map.name} Loot
                <span className="block text-xs text-white/60">plus a bonus reward</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {map && (
        <div className="rounded-2xl border bg-card p-4">
          <LootMeter
            total={lootNow}
            target={target}
            label={map.state === "collecting" || map.state === "locked" ? `Loot to unlock Map ${map.level}` : map.state === "exploring" ? "Loot for your next checkpoint" : `Map ${map.level} Loot`}
          />
          {readyCp ? (
            <Link href={`/play/map?level=${map.level}`} className={cn(buttonVariants({ variant: "outline", size: "pill" }), "mt-3 w-full")}>
              <MapIcon className="size-4" aria-hidden /> {readyCp.name} is ready on Map {map.level}
            </Link>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Loot is a milestone. It is never used up, so every piece keeps counting toward this map&apos;s checkpoints.
            </p>
          )}
        </div>
      )}

      {box.completed ? (
        <div className="space-y-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-success" aria-hidden /> Map {box.level} complete. This box is retired.
          </p>
          <p className="text-xs text-muted-foreground">Its Loot can&apos;t move you forward any more, so it can no longer be opened.</p>
          <Link href={nextHref ?? "/play/prizes"} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "w-full")}>
            {nextHref ? `Continue to Mystery Box ${box.level + 1}` : "View your prizes"} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : box.locked ? (
        <div className="space-y-3 rounded-2xl border border-dashed bg-surface p-4 text-center">
          <p className="text-sm font-semibold">{box.lockReason}</p>
          {box.requiresMapLevel && (
            <Link href={`/play/map?level=${box.requiresMapLevel}`} className={cn(buttonVariants({ variant: "outline", size: "pill" }), "w-full")}>
              <MapIcon className="size-4" aria-hidden /> Go to Map {box.requiresMapLevel}
            </Link>
          )}
        </div>
      ) : !enabled ? (
        <p className="rounded-2xl border bg-surface p-4 text-center text-sm text-muted-foreground">Mystery Boxes are taking a short break. Your Credits are safe.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Price</p>
              <p className="flex items-center gap-1.5 font-heading text-xl font-extrabold tabular">
                <Coins className="size-5 text-gold" aria-hidden />
                {formatCredits(box.priceCredits)} Credits
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground tabular">
              You have
              <span className="block text-sm font-bold text-foreground">{formatCredits(balance)} Credits</span>
              {!affordable && (
                <span className="mt-0.5 block font-semibold text-gold-foreground">Need {formatCredits(shortfall)} more</span>
              )}
            </div>
          </div>
          {affordable ? (
            <Button size="pill" variant="gold" className="h-12 w-full text-base" disabled={pending || phase === "opening"} onClick={() => setConfirmOpen(true)}>
              {phase === "opening" ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
              {phase === "opening" ? "Opening..." : "Open Mystery Box"}
            </Button>
          ) : (
            <div className="space-y-2 rounded-2xl border border-gold/40 bg-gold-soft p-3">
              <Link href={getCreditsHref} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 w-full text-base")}>
                Get Credits
              </Link>
              <p className="text-center text-xs text-muted-foreground">{canConvert ? "Convert from your Cash Wallet. You have enough Cash to cover it." : "Add money with a deposit, then convert it to Credits."}</p>
            </div>
          )}
        </div>
      )}

      <BoxOddsSheet name={box.name} rewards={odds.rewards} loot={odds.loot} />

      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">Open {box.name}?</SheetTitle>
            <SheetDescription>You&apos;ll receive one {map?.name ?? ""} Loot drop and one bonus reward.</SheetDescription>
          </SheetHeader>
          <dl className="mx-4 divide-y rounded-2xl border bg-card text-sm">
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted-foreground">Cost</dt>
              <dd className="font-bold tabular">{formatCredits(box.priceCredits)} Credits</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted-foreground">Your Credits</dt>
              <dd className="font-semibold tabular">{formatCredits(balance)}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted-foreground">After opening</dt>
              <dd className="font-semibold tabular">{formatCredits(Math.max(0, balance - box.priceCredits))}</dd>
            </div>
          </dl>
          <BoxOddsSheet
            name={box.name}
            rewards={odds.rewards}
            loot={odds.loot}
            trigger={
              <button type="button" className="mx-auto flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary hover:bg-brand-soft">
                View prizes & odds
              </button>
            }
          />
          <SheetFooter className="grid gap-2">
            <Button size="pill" variant="gold" className="h-12 text-base" onClick={confirm} disabled={pending}>
              Open for {formatCredits(box.priceCredits)} Credits
            </Button>
            <Button size="pill" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Not now
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AnimatePresence>
        {phase === "revealed" && result && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="box-reveal-title"
            className="fixed inset-0 z-50 grid place-items-center bg-ocean-deep/70 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_25%,var(--ocean),var(--ocean-deep))] p-6 text-white ring-1 ring-white/10"
              initial={reduce ? { opacity: 0 } : { scale: 0.85, y: 24, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
            >
              <button onClick={close} className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-white/70 hover:bg-white/10" aria-label="Close">
                <X className="size-5" />
              </button>
              <p id="box-reveal-title" className="text-center text-sm font-bold text-amber-200">
                {box.name} opened
              </p>
              <div className="mt-4 space-y-2" aria-live="polite">
                {result.loot.map((l, i) => (
                  <motion.div
                    key={`loot-${i}`}
                    className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"
                    initial={reduce ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <LootToken icon={l.icon} rarity={l.rarity} size="md" className="bg-white/95" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-200">Loot</p>
                      <p className="font-heading text-lg leading-tight font-extrabold">+{qty(l.amount)} {l.itemName ?? l.label}</p>
                    </div>
                  </motion.div>
                ))}
                <motion.div
                  className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"
                  initial={reduce ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <RewardGlyph type={result.reward.type} icon={result.reward.icon} rarity={result.reward.rarity} size="md" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: rarityOf(result.reward.rarity).hex === "#64748b" ? "#cbd5e1" : rarityOf(result.reward.rarity).hex }}>
                      Bonus reward · {rarityOf(result.reward.rarity).label}
                    </p>
                    <p className="font-heading text-lg leading-tight font-extrabold">{result.reward.type === "ITEM" ? result.reward.display : label(result.reward)}</p>
                    {result.reward.type === "CASH" && <p className="text-xs text-white/70">Cash rewards are under review before becoming available to withdraw.</p>}
                  </div>
                </motion.div>
              </div>
              {map && (
                <div className="mt-4 rounded-2xl bg-black/20 p-3">
                  <LootMeter tone="dark" total={lootNow} target={target} label={`${map.name} Loot`} />
                </div>
              )}
              <div className="mt-5 grid gap-2">
                {mapReadyNow ? (
                  <Link href={`/play/map?level=${box.level}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 text-base")} onClick={() => router.refresh()}>
                    Map {box.level} is ready to unlock <ArrowRight className="size-4" aria-hidden />
                  </Link>
                ) : (
                  <Button size="pill" variant="gold" className="h-12 text-base" onClick={close}>
                    Collect
                  </Button>
                )}
                {mapReadyNow ? (
                  <Button size="pill" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={close}>
                    Stay here
                  </Button>
                ) : (
                  map &&
                  map.state !== "locked" && (
                    <Link href={`/play/map?level=${box.level}`} className={cn(buttonVariants({ variant: "ghost", size: "pill" }), "text-white hover:bg-white/10 hover:text-white")}>
                      View Map {box.level}
                    </Link>
                  )
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
