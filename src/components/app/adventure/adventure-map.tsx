"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Flag, Gift, Loader2, Lock, MapPin, Puzzle, Sparkles, Trophy, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { newKey, useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { openBigBoxAction, unlockCheckpointAction, unlockMapAction } from "@/server/actions/games";
import type { AdventureMapView, BigBoxResult, CheckpointResult, CheckpointView } from "@/server/services/adventure";
import { ART, mapArt } from "../art";
import { LootCollection, LootIcon, LootMeter } from "./loot";

type Ordered = CheckpointView & { index: number };

function ordered(cps: CheckpointView[]): Ordered[] {
  return [...cps].sort((a, b) => Number(a.isFinal) - Number(b.isFinal) || a.position - b.position).map((c, index) => ({ ...c, index }));
}

/** Full-screen celebration card, shared by map completion and the Big Mystery Box reveal. */
function Celebration({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="fixed inset-0 z-50 grid place-items-center bg-ocean-deep/70 p-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_25%,oklch(0.42_0.08_215),oklch(0.24_0.05_228))] p-6 text-center text-white ring-1 ring-white/10"
            initial={reduce ? { opacity: 0 } : { scale: 0.85, y: 24, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
          >
            <button onClick={onClose} className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-white/70 hover:bg-white/10" aria-label="Close">
              <X className="size-5" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AdventureMap({ map, enabled, nextMap }: { map: AdventureMapView; enabled: boolean; nextMap: { level: number; name: string } | null }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const cps = ordered(map.checkpoints);
  const unlocked = map.state === "exploring" || map.state === "completed";
  const [selected, setSelected] = useState<Ordered | null>(null);
  const [completion, setCompletion] = useState<CheckpointResult | null>(null);
  const [bigBoxOpen, setBigBoxOpen] = useState(false);
  const [bigBox, setBigBox] = useState<BigBoxResult | null>(null);
  const [shaking, setShaking] = useState(false);
  const bbKey = useRef<string | null>(null);
  const art = mapArt(map.level, map.artwork);

  const unlockMap = useAction(unlockMapAction, { success: (d) => (d.replayed ? null : `Map ${d.level} unlocked: ${d.name}`) });
  const discover = useAction(unlockCheckpointAction, {
    refresh: false,
    onSuccess: (d) => {
      setSelected(null);
      if (d.completion) setCompletion(d);
      else {
        if (!d.replayed) toast.success(`Checkpoint discovered: ${d.name}`);
        router.refresh();
      }
    },
  });
  const openBig = useAction(openBigBoxAction, {
    refresh: false,
    onSuccess: (d) => {
      bbKey.current = null;
      setTimeout(
        () => {
          setShaking(false);
          setBigBox(d);
        },
        reduce ? 0 : 1100,
      );
    },
    onError: () => setShaking(false),
  });

  function startBigBox() {
    setCompletion(null);
    setBigBoxOpen(true);
  }
  function openBigBox() {
    bbKey.current ??= newKey();
    setShaking(true);
    openBig.run({ mapId: map.id, idempotencyKey: bbKey.current });
  }
  function closeAll() {
    setCompletion(null);
    setBigBoxOpen(false);
    setBigBox(null);
    router.refresh();
  }

  const lastDone = [...cps].reverse().find((c) => c.state === "completed");
  const start = { x: cps[0]?.posX ?? 50, y: 100 };
  const points = [start, ...cps.map((c) => ({ x: c.posX, y: c.posY }))];
  const donePoints = [start, ...cps.filter((c) => c.state === "completed").map((c) => ({ x: c.posX, y: c.posY }))];
  const toStr = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(" ");
  const bigBoxAvailable = map.bigBox?.state === "available";

  return (
    <div className="space-y-4">
      <div className="relative isolate aspect-[3/4] overflow-hidden rounded-[2rem] bg-ocean-deep shadow-lg ring-1 ring-black/5">
        <Image src={art} alt={`${map.name} map`} fill priority sizes="(max-width: 430px) 100vw, 430px" unoptimized={/^https?:/.test(art)} className={cn("-z-10 object-cover transition-[filter] duration-700", !unlocked && "brightness-[0.55] saturate-[0.6]")} />

        {unlocked && (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
              <polyline points={toStr(points)} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 7" vectorEffect="non-scaling-stroke" />
              {donePoints.length > 1 && <polyline points={toStr(donePoints)} fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            </svg>
            <span className="absolute bottom-1.5 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white" style={{ left: `${start.x}%` }}>
              <Flag className="size-3" aria-hidden /> Start
            </span>

            {cps.map((c) => {
              const done = c.state === "completed";
              const available = c.state === "available";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c)}
                  aria-label={`${c.isFinal ? "Final checkpoint" : `Checkpoint ${c.index + 1}`}: ${c.name}. ${done ? "Discovered" : available ? "Ready to discover" : `Needs ${c.lootRequired} Loot`}`}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 outline-none"
                  style={{ left: `${c.posX}%`, top: `${c.posY}%` }}
                >
                  <span
                    className={cn(
                      "relative grid place-items-center rounded-full border-[3px] shadow-lg transition-transform group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-white/70",
                      c.isFinal ? "size-14" : "size-12",
                      done && "border-white bg-success text-white",
                      available && "border-white bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.76_0.16_70))] text-amber-950 ring-4 ring-amber-300/50",
                      !done && !available && "border-white/60 bg-slate-900/70 text-white/80 backdrop-blur-sm",
                    )}
                  >
                    {done ? (
                      <Check className="size-6" strokeWidth={3} aria-hidden />
                    ) : c.isFinal ? (
                      <Gift className="size-6" aria-hidden />
                    ) : available ? (
                      <LootIcon icon={c.landmark} className="size-6" />
                    ) : (
                      <Lock className="size-5" aria-hidden />
                    )}
                    {!done && !available && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 text-[10px] leading-4 font-bold text-slate-900 tabular">{c.lootRequired}</span>
                    )}
                  </span>
                  {(c.isNext || c.isFinal) && (
                    <span
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-white",
                        c.posX >= 50 ? "right-full mr-2" : "left-full ml-2",
                      )}
                    >
                      {c.name}
                    </span>
                  )}
                </button>
              );
            })}

            {lastDone && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute -translate-x-1/2"
                style={{ left: `${lastDone.posX}%`, top: `calc(${lastDone.posY}% - 3.25rem)` }}
                animate={reduce ? undefined : { y: [0, -4, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <MapPin className="size-8 fill-rose-500 text-white drop-shadow-md" strokeWidth={1.75} />
              </motion.span>
            )}
          </>
        )}

        {!unlocked && (
          <div className="absolute inset-0 grid place-items-center p-5">
            <div className="w-full max-w-xs rounded-3xl bg-black/55 p-5 text-center text-white ring-1 ring-white/15 backdrop-blur-md">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10 ring-2 ring-white/25">
                <Lock className="size-6" aria-hidden />
              </span>
              <p className="mt-3 text-xs font-bold text-amber-200">Map {map.level}</p>
              <p className="font-heading text-2xl font-extrabold">{map.name}</p>
              {map.state === "locked" ? (
                <p className="mt-2 text-sm text-white/80">Complete Map {map.prerequisiteLevel} to reach this map.</p>
              ) : (
                <>
                  <LootMeter tone="dark" className="mt-4 text-left" total={map.lootCollected} target={map.lootRequired} label="Loot to unlock" />
                  {map.state === "ready" ? (
                    <Button size="pill" variant="gold" className="mt-4 h-12 w-full text-base" disabled={!enabled || unlockMap.pending} onClick={() => unlockMap.run(map.id)}>
                      {unlockMap.pending && <Loader2 className="animate-spin" aria-hidden />}
                      Unlock Map {map.level}
                    </Button>
                  ) : (
                    <Link href={`/app/play/mystery-box?level=${map.level}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "mt-4 h-12 w-full text-base")}>
                      Find Loot in Mystery Box {map.level}
                    </Link>
                  )}
                  <p className="mt-2 text-xs text-white/60">Your Loot is never used up. It keeps counting toward checkpoints.</p>
                </>
              )}
            </div>
          </div>
        )}

        {bigBoxAvailable && (
          <button
            type="button"
            onClick={startBigBox}
            className="absolute inset-x-4 bottom-4 flex min-h-14 items-center gap-3 rounded-2xl bg-white/95 p-2.5 pr-4 text-left shadow-xl ring-2 ring-amber-300 outline-none focus-visible:ring-4"
          >
            <Image src={ART.bigBox} alt="" width={48} height={48} className="size-12 rounded-xl object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block font-heading font-extrabold">Big Mystery Box found</span>
              <span className="block text-xs text-muted-foreground">Open it to find 1 to 3 Puzzle Pieces</span>
            </span>
            <ArrowRight className="size-5 text-amber-600" aria-hidden />
          </button>
        )}
      </div>

      {unlocked && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border bg-card p-3">
            <p className="font-heading text-xl font-extrabold tabular">
              {map.checkpointsDone}/{cps.length}
            </p>
            <p className="text-xs text-muted-foreground">Checkpoints</p>
          </div>
          <div className="rounded-2xl border bg-card p-3">
            <p className="font-heading text-xl font-extrabold tabular">{map.lootCollected}</p>
            <p className="text-xs text-muted-foreground">Loot collected</p>
          </div>
          <div className="rounded-2xl border bg-card p-3">
            <p className="font-heading text-xl font-extrabold tabular">{map.state === "completed" ? <Trophy className="mx-auto size-6 text-gold" aria-label="Completed" /> : map.nextLootTarget}</p>
            <p className="text-xs text-muted-foreground">{map.state === "completed" ? "Completed" : "Next target"}</p>
          </div>
        </div>
      )}

      {map.bigBox && map.bigBox.state === "opened" && (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
          <Image src={ART.bigBox} alt="" width={48} height={48} className="size-12 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Big Mystery Box opened</p>
            <p className="text-xs text-muted-foreground">
              You found {map.bigBox.piecesFound} Puzzle {map.bigBox.piecesFound === 1 ? "Piece" : "Pieces"}
            </p>
          </div>
          <Link href="/app/play/prizes" className={cn(buttonVariants({ variant: "outline", size: "pill" }))}>
            Puzzles
          </Link>
        </div>
      )}

      <section aria-labelledby="loot-title" className="space-y-2">
        <h2 id="loot-title" className="font-heading text-lg font-bold">
          {map.name} Loot
        </h2>
        <LootCollection items={map.lootItems} total={map.lootCollected} target={map.state === "completed" ? Math.max(map.lootCollected, map.nextLootTarget) : map.nextLootTarget} />
        {map.state !== "completed" && map.state !== "locked" && (
          <Link href={`/app/play/mystery-box?level=${map.level}`} className={cn(buttonVariants({ variant: "outline", size: "pill" }), "w-full")}>
            Find more Loot in Mystery Box {map.level}
          </Link>
        )}
      </section>

      {cps.length > 0 && (
        <section aria-labelledby="route-title" className="space-y-2">
          <h2 id="route-title" className="font-heading text-lg font-bold">
            Route
          </h2>
          <ol className="space-y-2">
            {cps.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setSelected(c)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-card px-3 py-2 text-left hover:bg-surface">
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full",
                      c.state === "completed" ? "bg-success-soft text-success" : c.state === "available" ? "bg-gold-soft text-gold-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c.state === "completed" ? <Check className="size-5" aria-hidden /> : c.isFinal ? <Gift className="size-5" aria-hidden /> : <LootIcon icon={c.landmark} className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.state === "completed" ? "Discovered" : c.state === "available" ? "Ready to discover" : `Needs ${c.lootRequired} Loot`}
                      {c.isFinal && " · Final checkpoint"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-[430px] rounded-t-3xl pb-safe">
          {selected && (
            <>
              <SheetHeader>
                <p className="text-xs font-bold text-primary">{selected.isFinal ? "Final checkpoint" : `Checkpoint ${selected.index + 1} of ${cps.length}`}</p>
                <SheetTitle className="font-heading text-xl">{selected.name}</SheetTitle>
                <SheetDescription>{selected.description}</SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-4">
                {selected.state === "completed" ? (
                  <p className="flex items-center gap-2 rounded-2xl bg-success-soft p-3 text-sm font-semibold text-success">
                    <Check className="size-4" aria-hidden /> Discovered
                  </p>
                ) : (
                  <LootMeter total={map.lootCollected} target={selected.lootRequired} label="Loot needed" />
                )}
                {selected.isFinal && selected.state !== "completed" && (
                  <p className="rounded-2xl bg-gold-soft p-3 text-sm">Reaching this checkpoint completes {map.name}, reveals the Big Mystery Box and unlocks the next map and Mystery Box.</p>
                )}
              </div>
              <SheetFooter>
                {selected.state === "available" ? (
                  <Button size="pill" variant="gold" className="h-12 text-base" disabled={!enabled || discover.pending} onClick={() => discover.run(selected.id)}>
                    {discover.pending && <Loader2 className="animate-spin" aria-hidden />}
                    {selected.isFinal ? "Reach the final checkpoint" : "Discover checkpoint"}
                  </Button>
                ) : selected.state === "locked" && !unlocked ? (
                  <p className="text-center text-sm text-muted-foreground">Unlock {map.name} first.</p>
                ) : selected.state === "locked" && map.lootCollected >= selected.lootRequired ? (
                  <p className="text-center text-sm text-muted-foreground">Discover the checkpoints before this one first.</p>
                ) : selected.state === "locked" ? (
                  <Link href={`/app/play/mystery-box?level=${map.level}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 text-base")}>
                    Collect {selected.lootRequired - map.lootCollected} more Loot
                  </Link>
                ) : (
                  <Button size="pill" variant="ghost" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Celebration open={completion !== null} onClose={closeAll} labelledBy="map-complete-title">
        <Trophy className="mx-auto size-14 text-amber-300" aria-hidden />
        <p className="mt-2 text-sm font-bold text-amber-200">Map {map.level} complete</p>
        <p id="map-complete-title" className="font-heading text-3xl font-extrabold">
          {map.name}
        </p>
        <ul className="mt-4 space-y-2 text-left text-sm">
          {completion?.completion?.unlockedMap && (
            <li className="flex items-center gap-2 rounded-2xl bg-white/10 p-3">
              <Sparkles className="size-4 shrink-0 text-amber-200" aria-hidden /> Map {completion.completion.unlockedMap.level}: {completion.completion.unlockedMap.name} is now reachable
            </li>
          )}
          {completion?.completion?.unlockedBoxes.map((b) => (
            <li key={b.level} className="flex items-center gap-2 rounded-2xl bg-white/10 p-3">
              <Sparkles className="size-4 shrink-0 text-amber-200" aria-hidden /> {b.name} unlocked
            </li>
          ))}
          {completion?.bigBox && (
            <li className="flex items-center gap-2 rounded-2xl bg-white/10 p-3">
              <Gift className="size-4 shrink-0 text-amber-200" aria-hidden /> You found the Big Mystery Box
            </li>
          )}
        </ul>
        <div className="mt-5 grid gap-2">
          {completion?.bigBox ? (
            <Button size="pill" variant="gold" className="h-12 text-base" onClick={startBigBox}>
              Open Big Mystery Box
            </Button>
          ) : (
            <Button size="pill" variant="gold" className="h-12 text-base" onClick={closeAll}>
              Continue
            </Button>
          )}
        </div>
      </Celebration>

      <Celebration open={bigBoxOpen} onClose={closeAll} labelledBy="big-box-title">
        <p id="big-box-title" className="text-sm font-bold text-amber-200">
          Big Mystery Box · Map {map.level}
        </p>
        <motion.div
          className="relative mx-auto mt-3 size-44"
          animate={shaking && !reduce ? { rotate: [0, -4, 4, -4, 4, -2, 2, 0], scale: [1, 1.05, 1.02, 1.07] } : { rotate: 0, scale: bigBox ? 0.85 : 1 }}
          transition={shaking ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 260, damping: 18 }}
        >
          <Image src={ART.bigBox} alt="" fill sizes="176px" className="rounded-3xl object-cover" />
        </motion.div>
        {bigBox ? (
          <div aria-live="polite">
            <div className="mt-3 flex justify-center gap-2">
              {Array.from({ length: bigBox.pieces }, (_, i) => (
                <motion.span
                  key={i}
                  className="grid size-14 place-items-center rounded-2xl bg-white/95 text-amber-600 ring-2 ring-amber-300"
                  initial={reduce ? false : { scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 * i }}
                >
                  <Puzzle className="size-7" aria-hidden />
                </motion.span>
              ))}
            </div>
            <p className="mt-3 font-heading text-3xl font-extrabold">
              {bigBox.pieces} Puzzle {bigBox.pieces === 1 ? "Piece" : "Pieces"}
            </p>
            <p className="text-sm text-white/75">You now have {bigBox.totalPieces} in total.</p>
            {bigBox.completedPuzzles.length > 0 && (
              <p className="mt-3 rounded-2xl bg-amber-300/20 p-3 text-sm font-semibold text-amber-100">
                {bigBox.completedPuzzles.map((p) => `Level ${p.level} puzzle complete`).join(" · ")}. One final step to unlock {bigBox.completedPuzzles[0].prizeName}.
              </p>
            )}
            <div className="mt-5 grid gap-2">
              {bigBox.completedPuzzles.length > 0 ? (
                <Link href="/app/play/prizes" className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 text-base")} onClick={() => router.refresh()}>
                  Go to the final unlock
                </Link>
              ) : nextMap ? (
                <Link href={`/app/play/map?level=${nextMap.level}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 text-base")} onClick={() => router.refresh()}>
                  Continue to Map {nextMap.level}
                </Link>
              ) : (
                <Button size="pill" variant="gold" className="h-12 text-base" onClick={closeAll}>
                  Continue
                </Button>
              )}
              <Link href="/app/play/prizes" className={cn(buttonVariants({ variant: "ghost", size: "pill" }), "text-white hover:bg-white/10 hover:text-white")}>
                View puzzles
              </Link>
            </div>
          </div>
        ) : (
          <>
            {map.bigBox && (
              <ul className="mt-3 grid grid-cols-3 gap-2 text-sm" aria-label="Chance of each result">
                {map.bigBox.odds.map((o) => (
                  <li key={o.pieces} className="rounded-xl bg-white/10 py-2">
                    <span className="block font-bold">
                      {o.pieces} {o.pieces === 1 ? "piece" : "pieces"}
                    </span>
                    <span className="text-white/70 tabular">{o.pct}%</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-white/65">Decided securely on our servers when you open it. You can open it once.</p>
            <Button size="pill" variant="gold" className="mt-4 h-12 w-full text-base" disabled={shaking || openBig.pending || !enabled} onClick={openBigBox}>
              {(shaking || openBig.pending) && <Loader2 className="animate-spin" aria-hidden />}
              {shaking ? "Opening..." : "Open Big Mystery Box"}
            </Button>
          </>
        )}
      </Celebration>
    </div>
  );
}
