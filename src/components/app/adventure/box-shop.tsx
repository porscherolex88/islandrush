"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Coins, Flame, Info, Loader2, LockOpen, Map as MapIcon, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { newKey, useAction } from "@/hooks/use-action";
import { cashMinorToCredits, formatCredits, toDecimal } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { openBoxAction } from "@/server/actions/games";
import type { AdventureBoxView, AdventureMapView } from "@/server/services/adventure";
import type { BoxPlayResult, JackpotSpin, PrizeList } from "@/server/services/mystery-box";
import { boxArt, boxOpenArt } from "../art";
import { BoxChest } from "./box-chest";
import { JackpotFire } from "./jackpot-fire";
import { LootToken } from "./loot";
import { BoxPrizesSheet, prizeKeyOf, RewardGlyph, useOddLabel, usePrizeTiles } from "./prizes-list";
import { PrizeReel, type ReelStop } from "./prize-reel";

function qty(amount: string) {
  return Math.max(1, Math.floor(Number(amount) || 1));
}

type Phase = "idle" | "unlocking" | "opened" | "revealed" | "jackpot" | "jackpotDone";

/** Shortest time the chest shakes before it bursts open, so the unlock always reads. */
const UNLOCK_MS = 1100;

export function BoxShop({
  box,
  map,
  credits,
  cashMinor,
  rate,
  prizes,
  enabled,
  className,
}: {
  box: AdventureBoxView;
  map: AdventureMapView | null;
  credits: number;
  /** Cash Wallet balance in minor units, used to decide whether "Get Credits" converts or deposits. */
  cashMinor: string;
  rate: { cashMinor: string; credits: number };
  prizes: { rewards: PrizeList; loot: PrizeList };
  enabled: boolean;
  className?: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const label = useOddLabel();
  const tiles = usePrizeTiles(prizes.rewards, prizes.loot);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<BoxPlayResult | null>(null);
  const [land, setLand] = useState<ReelStop | null>(null);
  const [prizeOut, setPrizeOut] = useState(false);
  const [balance, setBalance] = useState(credits);
  const [freePlays, setFreePlays] = useState(box.freePlays);
  const [meter, setMeter] = useState(box.jackpot);
  const [jpIndex, setJpIndex] = useState(0);
  const [jpWon, setJpWon] = useState<JackpotSpin[]>([]);
  const keyRef = useRef<string | null>(null);
  const spinId = useRef(0);
  const startedAt = useRef(0);

  const { run, pending } = useAction(openBoxAction, {
    refresh: false,
    onSuccess: (d) => {
      keyRef.current = null;
      setBalance(Number(d.creditsBalance));
      setFreePlays(d.freePlaysLeft);
      setMeter(d.jackpot && d.meter ? { ...d.meter, plays: d.meter.target } : d.meter);
      setResult(d);
      // Keep Daily mission progress current while the open animation plays.
      router.refresh();
      const wait = reduce ? 0 : Math.max(0, UNLOCK_MS - (Date.now() - startedAt.current));
      setTimeout(() => {
        setPhase("opened");
        setLand({ key: prizeKeyOf(d.reward.type), id: ++spinId.current });
      }, wait);
    },
    onError: () => setPhase("idle"),
  });

  const onLanded = useCallback(() => {
    setPrizeOut(true);
    setTimeout(() => setPhase("revealed"), reduce ? 0 : 1100);
  }, [reduce]);

  const jpSpins = useMemo(() => result?.jackpot?.spins ?? [], [result]);

  function startJackpot() {
    if (!jpSpins.length) return;
    setPhase("jackpot");
    setPrizeOut(false);
    setJpIndex(0);
    setJpWon([]);
    setLand(null);
    setTimeout(() => setLand({ key: prizeKeyOf(jpSpins[0].reward.type), id: ++spinId.current }), reduce ? 0 : 700);
  }

  const onJackpotLanded = useCallback(() => {
    const next = jpIndex + 1;
    setJpWon(jpSpins.slice(0, next));
    setTimeout(
      () => {
        if (next < jpSpins.length) {
          setJpIndex(next);
          setLand({ key: prizeKeyOf(jpSpins[next].reward.type), id: ++spinId.current });
        } else {
          setPhase("jackpotDone");
        }
      },
      reduce ? 0 : 450,
    );
  }, [jpIndex, jpSpins, reduce]);

  const affordable = freePlays > 0 || balance >= box.priceCredits;
  const shortfall = Math.max(0, box.priceCredits - balance);
  const rateCash = BigInt(rate.cashMinor);
  const rateCredits = BigInt(rate.credits);
  let cashNeeded = rateCredits > 0n ? (BigInt(shortfall) * rateCash + rateCredits - 1n) / rateCredits : 0n;
  if (rateCash > 0n && cashMinorToCredits(cashNeeded, rateCash, rateCredits) < BigInt(shortfall)) cashNeeded += 1n;
  const canConvert = cashNeeded > 0n && cashNeeded <= BigInt(cashMinor);
  const getCreditsHref = canConvert ? `/wallet/convert?amount=${toDecimal(cashNeeded)}` : "/wallet/deposit";
  const art = boxArt(box.level, box.artwork);
  const openArt = boxOpenArt(box.level, box.artwork);
  const mapHref = `/play/map?level=${map?.level ?? box.level}`;
  const busy = phase !== "idle" || pending;
  const playable = !box.locked && enabled;

  function open(force = false) {
    if ((busy && !force) || !affordable) return;
    keyRef.current ??= newKey();
    setLand(null);
    setPrizeOut(false);
    setPhase("unlocking");
    startedAt.current = Date.now();
    run({ boxId: box.id, idempotencyKey: keyRef.current });
  }

  function close() {
    setPhase("idle");
    setLand(null);
    setPrizeOut(false);
    if (result?.jackpot) setMeter(result.meter);
    setResult(null);
    setJpWon([]);
    router.refresh();
  }

  function playAgain() {
    setResult(null);
    open(true);
  }

  return (
    <>
      <section
        style={{ "--box": box.theme?.color ?? "#2563eb" } as CSSProperties}
        className={cn(
          "relative isolate flex min-h-0 flex-col overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_18%,color-mix(in_oklab,var(--box)_70%,white)_0%,var(--box)_38%,color-mix(in_oklab,var(--box)_40%,black)_100%)] px-3 pt-3 pb-3 text-white",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Link href={mapHref} className="flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-black/25 px-3 text-xs font-bold hover:bg-black/35">
            <MapIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{map?.name ?? `Map ${box.level}`}</span>
          </Link>
          <BoxPrizesSheet
            name={box.name}
            rewards={prizes.rewards}
            loot={prizes.loot}
            trigger={
              <button type="button" className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-black/25 px-3 text-xs font-bold hover:bg-black/35">
                <Info className="size-3.5" aria-hidden /> Prizes
              </button>
            }
          />
        </div>

        <BoxChest
          closed={art}
          open={openArt}
          name={box.name}
          stage={phase === "unlocking" ? "unlocking" : phase === "idle" ? "idle" : "opened"}
          playable={playable}
          locked={box.locked}
          prize={phase === "jackpot" ? (jpWon.at(-1)?.reward ?? null) : prizeOut && result ? result.reward : null}
          className="mx-auto my-1 min-h-20 w-full max-w-64 flex-1"
        />
        <h2 className="truncate text-center font-heading text-xl leading-tight font-extrabold">{box.name}</h2>

        <div className="mt-2.5">
          <PrizeReel
            tiles={tiles}
            spinning={phase === "unlocking" || phase === "opened" || phase === "jackpot"}
            landOn={land}
            onLanded={phase === "jackpot" ? onJackpotLanded : onLanded}
            fast={phase === "jackpot"}
          />
        </div>
        {meter && !box.locked && <JackpotFire className="mt-2.5" plays={meter.plays} target={meter.target} spins={meter.spins} blazing={phase === "jackpot" || phase === "jackpotDone"} />}

        <div className="mt-2.5">
          {phase === "jackpot" ? (
            <div className="flex h-14 items-center justify-center gap-2 rounded-full bg-orange-500 text-lg font-extrabold" aria-live="polite">
              <Flame className="size-5 fill-amber-200" aria-hidden /> Free spin {Math.min(jpIndex + 1, jpSpins.length)} of {jpSpins.length}
            </div>
          ) : box.locked ? (
            <div className="space-y-2 text-center">
              <p className="text-sm font-semibold text-white/85">{box.lockReason}</p>
              {box.unlockMapLevel && (
                <Link href={`/play/map?level=${box.unlockMapLevel}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-14 w-full text-lg")}>
                  <MapIcon className="size-5" aria-hidden /> Go to Map {box.unlockMapLevel}
                </Link>
              )}
            </div>
          ) : !enabled ? (
            <p className="rounded-2xl bg-black/25 p-4 text-center text-sm">Mystery Boxes are taking a short break. Your Credits are safe.</p>
          ) : affordable ? (
            <Button size="pill" variant="gold" className="h-14 w-full text-lg" disabled={busy} onClick={() => open()}>
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : freePlays > 0 ? <LockOpen className="size-5" aria-hidden /> : <Coins className="size-5" aria-hidden />}
              {busy ? "Opening..." : freePlays > 0 ? `Open for free${freePlays > 1 ? ` (${freePlays} left)` : ""}` : `Open for ${formatCredits(box.priceCredits)}`}
            </Button>
          ) : (
            <div className="space-y-1.5">
              <Link href={getCreditsHref} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-14 w-full text-lg")}>
                Get {formatCredits(shortfall)} more Credits
              </Link>
              <p className="text-center text-xs text-white/75">{canConvert ? "Convert from your Cash Wallet" : "Add money, then convert it to Credits"}</p>
            </div>
          )}
        </div>
      </section>

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
              className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_20%,var(--ocean),var(--ocean-deep))] p-6 text-center text-white ring-1 ring-white/10"
              initial={reduce ? { opacity: 0 } : { scale: 0.8, y: 24, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
            >
              <button onClick={close} className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-white/70 hover:bg-white/10" aria-label="Close">
                <X className="size-5" />
              </button>
              <p id="box-reveal-title" className="text-sm font-bold text-amber-200">
                You won
              </p>
              <div className="relative mx-auto mt-1 grid size-36 place-items-center" aria-hidden>
                <motion.span
                  className="absolute -inset-6"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1, rotate: reduce ? 0 : 360 }}
                  transition={{ opacity: { duration: 0.4 }, scale: { duration: 0.5 }, rotate: { duration: 16, ease: "linear", repeat: Infinity } }}
                  style={{
                    background: "repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 236 160 / 0.28) 0deg 10deg, transparent 10deg 26deg)",
                    maskImage: "radial-gradient(circle at 50% 50%, #000 18%, transparent 68%)",
                    WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 18%, transparent 68%)",
                  }}
                />
                <span className="absolute inset-8 rounded-full bg-amber-200/30 blur-xl" />
                <motion.div
                  className="relative"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.2, rotate: -12 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1.25, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
                >
                  <RewardGlyph type={result.reward.type} icon={result.reward.icon} rarity={result.reward.rarity} size="lg" />
                </motion.div>
              </div>
              <p className="mt-1 font-heading text-2xl leading-tight font-extrabold" aria-live="polite">
                {result.reward.type === "ITEM" || result.reward.type === "FREE_UNLOCK" ? result.reward.display : label(result.reward)}
              </p>
              <p className="mt-1 text-xs font-semibold" style={{ color: rarityOf(result.reward.rarity).hex === "#64748b" ? "#cbd5e1" : rarityOf(result.reward.rarity).hex }}>
                {rarityOf(result.reward.rarity).label}
              </p>
              {result.reward.type === "CASH" && <p className="mt-1 text-xs text-white/70">Cash rewards are reviewed before you can withdraw them.</p>}
              {result.reward.type === "FREE_UNLOCK" && result.reward.headline && <p className="mt-1 text-xs text-white/70">{result.reward.headline}</p>}

              {result.loot.map((l, i) => (
                <div key={i} className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/10">
                  <LootToken icon={l.icon} rarity={l.rarity} size="sm" className="bg-white/95" />
                  <span className="text-sm font-bold">
                    +{qty(l.amount)} {l.itemName ?? l.label}
                  </span>
                </div>
              ))}
              {result.jackpot && (
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-orange-500/25 p-3 text-left text-sm font-semibold ring-1 ring-orange-300/50">
                  <Flame className="size-5 shrink-0 fill-orange-400 text-amber-200" aria-hidden />
                  The jackpot fire is full! {result.jackpot.spins.length} free spins are ready.
                </div>
              )}
              <div className="mt-5 grid gap-2">
                {result.jackpot ? (
                  <Button size="pill" variant="gold" className="h-12 text-base" onClick={startJackpot}>
                    <Flame className="size-4" aria-hidden /> Start jackpot
                  </Button>
                ) : result.reward.type === "FREE_UNLOCK" && freePlays > 0 ? (
                  <Button size="pill" variant="gold" className="h-12 text-base" onClick={playAgain}>
                    <LockOpen className="size-4" aria-hidden /> Play again for free
                  </Button>
                ) : (
                  <Button size="pill" variant="gold" className="h-12 text-base" onClick={close}>
                    Collect
                  </Button>
                )}
                <Link href={mapHref} className={cn(buttonVariants({ variant: "ghost", size: "pill" }), "text-white hover:bg-white/10 hover:text-white")} onClick={() => router.refresh()}>
                  <MapIcon className="size-4" aria-hidden /> Check your map
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "jackpotDone" && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="jackpot-title"
            className="fixed inset-0 z-50 grid place-items-center bg-ocean-deep/70 p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,#9a3412,var(--ocean-deep)_70%)] p-6 text-center text-white ring-1 ring-orange-300/30"
              initial={reduce ? { opacity: 0 } : { scale: 0.8, y: 24, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
            >
              <button onClick={close} className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-white/70 hover:bg-white/10" aria-label="Close">
                <X className="size-5" />
              </button>
              <motion.span className="mx-auto" aria-hidden animate={reduce ? undefined : { scale: [1, 1.12, 1], rotate: [-3, 3, -3] }} transition={{ duration: 1, repeat: Infinity }}>
                <Flame className="size-14 fill-orange-400 text-amber-200 drop-shadow-[0_0_14px_#f97316]" />
              </motion.span>
              <p id="jackpot-title" className="mt-1 font-heading text-3xl font-extrabold">
                Jackpot!
              </p>
              <p className="text-sm text-white/75">You won {jpWon.length} prizes from {jpSpins.length} free spins</p>
              <ul className="mt-4 grid min-h-0 grid-cols-2 gap-2 overflow-y-auto text-left">
                {jpWon.map((w, i) => (
                  <motion.li
                    key={i}
                    className="flex items-center gap-2 rounded-2xl bg-white/10 p-2 ring-1 ring-white/10"
                    initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * i }}
                  >
                    <RewardGlyph type={w.reward.type} icon={w.reward.icon} rarity={w.reward.rarity} />
                    <span className="min-w-0 text-xs leading-tight font-bold">{w.reward.type === "ITEM" || w.reward.type === "FREE_UNLOCK" ? w.reward.display : label(w.reward)}</span>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-white/70">Every spin also added Loot to your collection.</p>
              <Button size="pill" variant="gold" className="mt-4 h-12 text-base" onClick={close}>
                Collect all
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
