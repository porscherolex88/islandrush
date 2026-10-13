"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Flag, Gift, Loader2, Lock, MapPin, Puzzle, Sparkles, Trophy, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { newKey, useAction } from "@/hooks/use-action";
import { lootEmoji, routeChests, type RouteChest } from "@/lib/adventure";
import { defaultTrail, densify, pointAt, progressOf, slice, toPoints, type Pt } from "@/lib/adventure-trails";
import { cn } from "@/lib/utils";
import { openBigBoxAction, unlockCheckpointAction, unlockMapAction } from "@/server/actions/games";
import type { AdventureMapView, BigBoxResult, CheckpointResult, CheckpointView, LootItemView } from "@/server/services/adventure";
import { ART, mapArt } from "../art";
import { headerIconButton } from "../header-buttons";
import { LootMeter } from "./loot";

type Ordered = CheckpointView & { index: number; chest: RouteChest; at: number; x: number; y: number };

/**
 * Lays the route out along one smooth line: the painted trail for default art, otherwise a curve
 * through the checkpoints. Each checkpoint sits on the line and holds that stretch's chest.
 */
function layout(map: AdventureMapView): { line: Pt[]; cps: Ordered[] } {
  const sorted = [...map.checkpoints].sort((a, b) => Number(a.isFinal) - Number(b.isFinal) || a.position - b.position);
  const chests = routeChests(sorted, map.lootRequired, map.lootCollected);
  const trail = defaultTrail(map.level, map.artwork);
  const line = densify(trail ?? [{ x: sorted[0]?.posX ?? 50, y: 100 }, ...sorted.map((c) => ({ x: c.posX, y: c.posY }))]);
  let prev = 0;
  const cps = sorted.map((c, index) => {
    const at = Math.max(prev, progressOf(line, { x: c.posX, y: c.posY }));
    const p = pointAt(line, at);
    prev = at;
    return { ...c, index, chest: chests[index], at, x: p.x, y: p.y };
  });
  return { line, cps };
}

const MAX_SLOTS = 24;

/** The Loot pieces sitting in one route's chest, in the order they were collected across the map's Loot types. */
function chestSlots(items: LootItemView[], chest: RouteChest) {
  const pieces = items.flatMap((it) => Array.from({ length: it.collected }, () => it.icon));
  const fallback = items[0]?.icon ?? "gem";
  return Array.from({ length: chest.need }, (_, i) => (i < chest.have ? (pieces[chest.from + i] ?? fallback) : null));
}

function ChestSlots({ items, chest }: { items: LootItemView[]; chest: RouteChest }) {
  if (chest.need > MAX_SLOTS) return <LootMeter total={chest.have} target={chest.need} label="Loot in this chest" doneLabel="Chest full" />;
  return (
    <ul className="grid grid-cols-6 gap-2" aria-label={`${chest.have} of ${chest.need} Loot collected`}>
      {chestSlots(items, chest).map((icon, i) => (
        <li
          key={i}
          className={cn(
            "grid aspect-square place-items-center rounded-xl text-xl ring-2",
            icon ? "bg-gold-soft ring-amber-300" : "border-2 border-dashed border-border bg-muted/40 ring-transparent",
          )}
        >
          {icon && <span aria-hidden>{lootEmoji(icon)}</span>}
        </li>
      ))}
    </ul>
  );
}

function PanelHead({ image, icon, eyebrow, title, text }: { image?: string; icon?: ReactNode; eyebrow: string; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      {image ? (
        <Image src={image} alt="" width={56} height={56} className="size-14 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-primary">{eyebrow}</p>
        <h2 className="truncate font-heading text-lg leading-tight font-extrabold">{title}</h2>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/** Full-screen celebration card, shared by map completion and the Big Mystery Box reveal. */
function Celebration({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="fixed inset-0 z-50 grid place-items-center bg-ocean-deep/70 p-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_25%,var(--ocean),var(--ocean-deep))] p-6 text-center text-white ring-1 ring-white/10"
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

/** Direction of the last swipe, read once by the next map card so it slides in from the matching side. */
const lastSwipe: { dir: -1 | 0 | 1 } = { dir: 0 };

export function AdventureMap({
  map,
  enabled,
  nextMap,
  prevLevel,
  nextLevel,
  levels,
  backHref,
  action,
}: {
  map: AdventureMapView;
  enabled: boolean;
  nextMap: { level: number; name: string } | null;
  prevLevel: number | null;
  nextLevel: number | null;
  levels: number;
  backHref: string;
  action?: ReactNode;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { line, cps } = useMemo(() => layout(map), [map]);
  const unlocked = map.state === "exploring" || map.state === "completed";
  const [viewId, setViewId] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CheckpointResult | null>(null);
  const [bigBoxOpen, setBigBoxOpen] = useState(false);
  const [bigBox, setBigBox] = useState<BigBoxResult | null>(null);
  const [shaking, setShaking] = useState(false);
  const bbKey = useRef<string | null>(null);
  const art = mapArt(map.level, map.artwork);
  const dragged = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState<-1 | 0 | 1>(0);
  const [entering] = useState(() => lastSwipe.dir);

  useEffect(() => {
    lastSwipe.dir = 0;
  }, []);

  useEffect(() => {
    if (prevLevel !== null) router.prefetch(`/play/map?level=${prevLevel}`);
    if (nextLevel !== null) router.prefetch(`/play/map?level=${nextLevel}`);
  }, [router, prevLevel, nextLevel]);

  useEffect(() => {
    const level = leaving === 1 ? nextLevel : leaving === -1 ? prevLevel : null;
    if (level === null) return;
    lastSwipe.dir = leaving;
    router.push(`/play/map?level=${level}`, { scroll: false });
  }, [leaving, nextLevel, prevLevel, router]);

  function go(dir: -1 | 1) {
    if ((dir === 1 ? nextLevel : prevLevel) === null || leaving) return;
    setLeaving(dir);
  }

  const unlockMap = useAction(unlockMapAction, { success: (d) => (d.replayed ? null : `Map ${d.level} unlocked: ${d.name}`) });
  const discover = useAction(unlockCheckpointAction, {
    refresh: false,
    onSuccess: (d) => {
      setViewId(null);
      if (d.completion) setCompletion(d);
      else {
        if (!d.replayed) toast.success(`Chest collected. You climbed up to ${d.name}`);
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

  const startAt = Math.min(0.07, (cps[0]?.at ?? 1) / 3);
  const start = pointAt(line, startAt);
  const lastDone = cps.filter((c) => c.state === "completed").at(-1);
  const routeLine = toPoints(slice(line, startAt, cps.at(-1)?.at ?? 1));
  const doneLine = lastDone ? toPoints(slice(line, startAt, lastDone.at)) : null;
  const bigBoxAvailable = map.bigBox?.state === "available";
  const here = lastDone ?? start;
  const activeRoute = cps.find((c) => c.chest.state === "filling" || c.chest.state === "full") ?? null;
  const shown = cps.find((c) => c.id === viewId) ?? activeRoute;
  const viewingOther = shown !== null && shown.id !== activeRoute?.id;
  const focusY = shown ? shown.y : here.y;
  const scrolled = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    const top = stage.offsetTop + (focusY / 100) * stage.offsetHeight - el.clientHeight * 0.55;
    el.scrollTo({ top, behavior: scrolled.current && !reduce ? "smooth" : "instant" });
    scrolled.current = true;
  }, [focusY, reduce]);

  const showRoute = (c: Ordered) => setViewId(c.id === activeRoute?.id ? null : c.id);

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden bg-ocean-deep desktop:h-full">
      <Image src={art} alt="" fill priority sizes="430px" unoptimized={/^https?:/.test(art)} className="-z-20 scale-125 object-cover blur-2xl brightness-[0.45]" />

      <header className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/55 to-transparent pt-[env(safe-area-inset-top)]">
        <div className="flex h-[66px] items-center gap-3 px-4">
          <Link href={backHref} className={headerIconButton} aria-label="Go back">
            <ArrowLeft className="size-[18px]" strokeWidth={2.25} aria-hidden />
          </Link>
          <div className="min-w-0 flex-1 text-white">
            <h1 className="truncate font-heading text-lg leading-tight font-extrabold tracking-tight">
              Map {map.level} · {map.name}
            </h1>
            <span className="mt-1 flex gap-1" role="img" aria-label={`Map ${map.level} of ${levels}`}>
              {Array.from({ length: levels }, (_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-all", i + 1 === map.level ? "w-4 bg-amber-300" : "w-1.5 bg-white/45")} />
              ))}
            </span>
          </div>
          {action}
        </div>
      </header>

      <motion.div
        ref={scrollRef}
        className="relative flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-none select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        drag={prevLevel !== null || nextLevel !== null ? "x" : false}
        dragDirectionLock
        dragElastic={{ left: nextLevel === null ? 0.1 : 0.6, right: prevLevel === null ? 0.1 : 0.6 }}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          setTimeout(() => (dragged.current = false), 0);
          const swipe = Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 500;
          if (!swipe) return;
          go(info.offset.x < 0 ? 1 : -1);
        }}
        onClickCapture={(e) => dragged.current && e.stopPropagation()}
        initial={reduce || entering === 0 ? false : { x: entering * 60, opacity: 0 }}
        animate={leaving ? { x: leaving * -120, opacity: 0 } : { x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        <div ref={stageRef} className="relative isolate my-auto aspect-[9/16] w-full shrink-0">
          <Image
            src={art}
            alt={`${map.name} map`}
            fill
            priority
            sizes="430px"
            unoptimized={/^https?:/.test(art)}
            className={cn(
              "-z-10 object-cover transition-[filter] duration-700",
              !unlocked && "brightness-[0.55] saturate-[0.6]",
            )}
          />

          {unlocked && (
            <>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
                <polyline points={routeLine} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 7" vectorEffect="non-scaling-stroke" />
                {doneLine && <polyline points={doneLine} fill="none" style={{ stroke: "var(--color-amber-400)" }} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
              </svg>
              <span className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-primary text-primary-foreground shadow-lg" style={{ left: `${start.x}%`, top: `${start.y}%` }} title="Start">
                <Flag className="size-4" aria-hidden />
              </span>

              {cps.map((c) => {
                const done = c.state === "completed";
                const { state, have, need } = c.chest;
                const isShown = c.id === shown?.id;
                const active = state === "filling" || state === "full";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => showRoute(c)}
                    aria-pressed={isShown}
                    aria-label={`${c.isFinal ? "Final checkpoint" : `Checkpoint ${c.index + 1}`}: ${c.name}. ${done ? "Chest collected" : state === "full" ? "Chest full, ready to collect" : state === "filling" ? `${have} of ${need} Loot in the chest` : `Needs ${c.lootRequired} Loot`}`}
                    className={cn("group absolute -translate-x-1/2 -translate-y-1/2 outline-none", isShown && "z-10")}
                    style={{ left: `${c.x}%`, top: `${c.y}%` }}
                  >
                    <motion.span
                      className={cn(
                        "relative grid place-items-center rounded-full border-[3px] shadow-lg group-focus-visible:ring-4 group-focus-visible:ring-white/70",
                        c.isFinal ? "size-14" : "size-12",
                        done && "border-white bg-success text-white",
                        state === "full" && "border-white bg-amber-300 ring-4 ring-amber-300/50",
                        state === "filling" && "border-amber-300 bg-slate-900/70",
                        state === "locked" && "border-white/60 bg-slate-900/70 text-white/80 backdrop-blur-sm",
                        isShown && "outline-4 outline-offset-2 outline-white/80",
                      )}
                      animate={isShown && !reduce ? { y: [0, -7, 0] } : { y: 0 }}
                      transition={isShown && !reduce ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                    >
                      {state === "full" && <span aria-hidden className="absolute -inset-1 rounded-full bg-amber-300/50 motion-safe:animate-ping" />}
                      {done ? (
                        <Check className="size-6" strokeWidth={3} aria-hidden />
                      ) : active ? (
                        <span className="absolute inset-0 overflow-hidden rounded-full">
                          <Image src={state === "full" ? ART.crateOpen : ART.crate} alt="" fill sizes="56px" className="object-cover" />
                        </span>
                      ) : c.isFinal ? (
                        <Gift className="size-6" aria-hidden />
                      ) : (
                        <Lock className="size-5" aria-hidden />
                      )}
                      {!done && (
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 text-[10px] leading-4 font-bold whitespace-nowrap text-slate-900 tabular">
                          {state === "full" ? "Collect" : state === "filling" ? `${have}/${need}` : c.lootRequired}
                        </span>
                      )}
                    </motion.span>
                    {(isShown || c.isFinal) && (
                      <span
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-white",
                          c.x >= 50 ? "right-full mr-2" : "left-full ml-2",
                        )}
                      >
                        {c.name}
                      </span>
                    )}
                  </button>
                );
              })}

            </>
          )}

          {!unlocked && (
            <span className="absolute inset-0 grid place-items-center" aria-hidden>
              <span className="grid size-16 place-items-center rounded-full bg-black/45 text-white ring-2 ring-white/30 backdrop-blur-md">
                <Lock className="size-7" />
              </span>
            </span>
          )}
        </div>
      </motion.div>

      {([
        [prevLevel, -1, "left-2", ChevronLeft],
        [nextLevel, 1, "right-2", ChevronRight],
      ] as const).map(([lvl, dir, side, Icon]) =>
        lvl === null ? null : (
          <button
            key={dir}
            type="button"
            onClick={() => go(dir)}
            aria-label={`Go to Map ${lvl}`}
            className={cn("absolute top-[40%] z-30 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 focus-visible:ring-4 focus-visible:ring-white/70 outline-none", side)}
          >
            <Icon className="size-5" aria-hidden />
          </button>
        ),
      )}

      <motion.section
        aria-label={`${map.name} progress`}
        className="relative z-10 -mt-6 space-y-3 rounded-t-3xl bg-background px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-10px_30px_rgba(0,0,0,0.25)]"
        animate={{ opacity: leaving ? 0 : 1 }}
      >
        {map.state === "locked" ? (
          <>
            <PanelHead icon={<Lock className="size-6" aria-hidden />} eyebrow={`Map ${map.level}`} title="Locked" text={`Complete Adventure Level ${map.prerequisiteLevel} to reach ${map.name}.`} />
            {prevLevel !== null && (
              <Button size="pill" variant="outline" className="h-12 w-full text-base" onClick={() => go(-1)}>
                <ChevronLeft className="size-4" aria-hidden /> Back to Map {prevLevel}
              </Button>
            )}
          </>
        ) : map.state === "collecting" || map.state === "ready" ? (
          <>
            <PanelHead image={ART.crate} eyebrow={`Map ${map.level}`} title={`Unlock ${map.name}`} text="Collect Loot from the Mystery Box to open this map." />
            <LootMeter total={map.lootCollected} target={map.lootRequired} label="Loot to unlock" />
            {map.state === "ready" ? (
              <Button size="pill" variant="gold" className="h-12 w-full text-base" disabled={!enabled || unlockMap.pending} onClick={() => unlockMap.run(map.id)}>
                {unlockMap.pending && <Loader2 className="animate-spin" aria-hidden />}
                Unlock Map {map.level}
              </Button>
            ) : (
              <Link href={`/play/mystery-box?level=${map.level}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 w-full text-base")}>
                Find Loot in Mystery Box {map.level}
              </Link>
            )}
          </>
        ) : unlocked && shown && (map.state === "exploring" || viewingOther) ? (
          <motion.div key={shown.id} className="space-y-3" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <PanelHead
              image={shown.chest.state === "full" || shown.chest.state === "opened" ? ART.crateOpen : ART.crate}
              eyebrow={`Checkpoint ${shown.index + 1} of ${cps.length}${viewingOther ? "" : " · You are here"}`}
              title={shown.name}
              text={
                (shown.chest.state === "opened"
                  ? `Chest collected. You climbed up to ${shown.name}.`
                  : shown.chest.state === "full"
                    ? "Chest full. Collect it to move up."
                    : shown.chest.state === "filling"
                      ? `Collect ${shown.chest.need - shown.chest.have} more Loot to fill the chest.`
                      : `This chest holds ${shown.chest.need} Loot. ${activeRoute ? `Fill the chest at Checkpoint ${activeRoute.index + 1} first.` : ""}`) + (shown.isFinal && shown.chest.state !== "opened" ? " Reaching it unlocks your puzzles." : "")
              }
            />
            <ChestSlots items={map.lootItems} chest={shown.chest} />
            {shown.chest.state === "full" ? (
              <Button size="pill" variant="gold" className="h-12 w-full text-base" disabled={!enabled || discover.pending} onClick={() => discover.run(shown.id)}>
                {discover.pending ? <Loader2 className="animate-spin" aria-hidden /> : shown.isFinal ? <Puzzle className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
                {shown.isFinal ? "Collect chest and unlock puzzles" : "Collect chest and move up"}
              </Button>
            ) : shown.chest.state === "filling" ? (
              <Link href={`/play/mystery-box?level=${map.level}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 w-full text-base")}>
                Find Loot in Mystery Box {map.level}
              </Link>
            ) : (
              <Button size="pill" variant="outline" className="h-12 w-full text-base" onClick={() => setViewId(null)}>
                <MapPin className="size-4" aria-hidden /> {activeRoute ? `Back to Checkpoint ${activeRoute.index + 1}` : "Back"}
              </Button>
            )}
          </motion.div>
        ) : bigBoxAvailable ? (
          <>
            <PanelHead image={ART.bigBox} eyebrow="Final checkpoint reached" title="Big Mystery Box found" text="Open it to find 1 to 3 Puzzle Pieces." />
            <Button size="pill" variant="gold" className="h-12 w-full text-base" onClick={startBigBox}>
              <Gift className="size-4" aria-hidden /> Open Big Mystery Box
            </Button>
          </>
        ) : (
          <>
            <PanelHead
              icon={<Trophy className="size-6 text-gold" aria-hidden />}
              eyebrow={`Map ${map.level} complete`}
              title="Puzzles unlocked"
              text={map.bigBox?.piecesFound ? `The final checkpoint gave you ${map.bigBox.piecesFound} Puzzle ${map.bigBox.piecesFound === 1 ? "Piece" : "Pieces"}.` : "You reached the final checkpoint."}
            />
            <div className={cn("grid gap-2", nextLevel !== null && "grid-cols-2")}>
              <Link href="/play/prizes" className={cn(buttonVariants({ variant: nextLevel !== null ? "outline" : "gold", size: "pill" }), "h-12 text-base")}>
                <Puzzle className="size-4" aria-hidden /> Puzzles
              </Link>
              {nextLevel !== null && (
                <Button size="pill" variant="gold" className="h-12 text-base" onClick={() => go(1)}>
                  Map {nextLevel} <ChevronRight className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          </>
        )}
      </motion.section>

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
              <Puzzle className="size-4 shrink-0 text-amber-200" aria-hidden /> Puzzles unlocked: open the Big Mystery Box for Puzzle Pieces
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
                {bigBox.completedPuzzles.map((p) => `Adventure Level ${p.level} puzzle complete`).join(" · ")}. One final step to unlock {bigBox.completedPuzzles[0].prizeName}.
              </p>
            )}
            <div className="mt-5 grid gap-2">
              {bigBox.completedPuzzles.length > 0 ? (
                <Link href="/play/prizes" className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 text-base")} onClick={() => router.refresh()}>
                  Go to the final unlock
                </Link>
              ) : nextMap ? (
                <Link href={`/play/map?level=${nextMap.level}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 text-base")} onClick={() => router.refresh()}>
                  Continue to Map {nextMap.level}
                </Link>
              ) : (
                <Button size="pill" variant="gold" className="h-12 text-base" onClick={closeAll}>
                  Continue
                </Button>
              )}
              <Link href="/play/prizes" className={cn(buttonVariants({ variant: "ghost", size: "pill" }), "text-white hover:bg-white/10 hover:text-white")}>
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
