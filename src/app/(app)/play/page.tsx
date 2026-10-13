import { BookOpen, Check, ChevronRight, Coins, Flag, History, Lock, MapPin, Package, Puzzle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LevelTrack } from "@/components/app/adventure/level-track";
import { LootMeter } from "@/components/app/adventure/loot";
import { BoxContents, BoxOddsSheet } from "@/components/app/adventure/odds";
import { boxTrack, mapLootGoal, mapTrack } from "@/components/app/adventure/tracks";
import { ART, mapArt } from "@/components/app/art";
import { Section } from "@/components/app/mobile-header";
import { PlayHeader } from "@/components/app/root-page-header";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { cn } from "@/lib/utils";
import { adventureBoxOdds, getAdventureState, type AdventureState } from "@/server/services/adventure";
import { getAllFlags } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Play" };

type StepStatus = "done" | "now" | "open" | "later";

/** Which of the four steps the player's next objective belongs to. */
function activeStep(s: AdventureState) {
  switch (s.nextStep.kind) {
    case "claim":
    case "wheel":
      return 4;
    case "bigbox":
      return 3;
    case "map":
    case "checkpoint":
      return 2;
    case "loot":
      return 1;
    default:
      return 0;
  }
}

function checkpointStatus(c: { state: string; isNext: boolean }) {
  if (c.state === "completed") return "Completed";
  if (c.state === "available") return "Available";
  return c.isNext ? "Current" : "Locked";
}

const STATUS_PILL: Record<StepStatus, { text: string; className: string }> = {
  done: { text: "Done", className: "bg-success/15 text-success" },
  now: { text: "Do this now", className: "bg-primary text-primary-foreground" },
  open: { text: "Available", className: "bg-brand-soft text-primary" },
  later: { text: "Later", className: "bg-muted text-muted-foreground" },
};

function Step({ n, title, does, status, statusText, wins, children }: { n: number; title: string; does: ReactNode; status: StepStatus; statusText?: string; wins: ReactNode; children?: ReactNode }) {
  const pill = STATUS_PILL[status];
  return (
    <li aria-current={status === "now" ? "step" : undefined} className={cn("rounded-3xl border bg-card p-4", status === "now" && "border-primary ring-4 ring-primary/10", status === "later" && "bg-surface")}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold",
            status === "done" ? "bg-success text-white" : status === "now" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {status === "done" ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-base leading-tight font-extrabold">{title}</h3>
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold", pill.className)}>{statusText ?? pill.text}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{does}</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-bold text-muted-foreground">You win</p>
        {wins}
      </div>
      {children}
    </li>
  );
}

export default async function PlayPage() {
  const user = await requireUser();
  const [s, flags, balances] = await Promise.all([getAdventureState(user.id), getAllFlags(), getBalances(user.id)]);
  const map = s.currentMap;
  const box = s.currentBox;
  const ready = s.maps.length > 0 && s.boxes.length > 0;
  const odds = box ? await adventureBoxOdds(box.id) : { rewards: [], loot: [] };
  const active = activeStep(s);
  const puzzle = s.puzzles.find((p) => p.level === s.currentLevel) ?? s.puzzles.find((p) => !p.complete) ?? null;
  const checkpoints = map ? [...map.checkpoints].sort((a, b) => Number(a.isFinal) - Number(b.isFinal) || a.position - b.position) : [];
  const goal = map ? mapLootGoal(map) : null;
  const boxOpenable = box && !box.locked && !box.completed && flags.mystery_box !== false;
  const nextStop = checkpoints.find((c) => c.state !== "completed") ?? null;
  const boxArt = box?.artwork ?? ART.crate3d;
  const mapDone = map?.state === "completed";
  const bigBox = map?.bigBox ?? null;

  const status = (n: number, done: boolean, open: boolean): StepStatus => (done ? "done" : n === active ? "now" : open ? "open" : "later");
  const boxStatus = status(1, Boolean(box?.completed), Boolean(boxOpenable));
  const mapStatus = status(2, mapDone, map?.state === "exploring" || map?.state === "ready");
  const bigBoxStatus = status(3, bigBox?.state === "opened", bigBox?.state === "available");
  const puzzleStatus = status(4, Boolean(puzzle?.attempt), Boolean(puzzle?.canSpin));
  const bigBoxOdds = bigBox?.odds.filter((o) => o.pct > 0) ?? [];

  return (
    <div className="pb-4">
      <PlayHeader level={s.currentLevel} totalLevels={s.totalLevels} mapName={map?.name ?? null} credits={balances.CREDITS} />

      {!ready ? (
        <Section>
          <div className="rounded-3xl border bg-card p-6 text-center">
            <p className="font-heading text-xl font-extrabold">Your adventure is being prepared</p>
            <p className="mt-1 text-sm text-muted-foreground">New maps and Mystery Boxes are on their way. Check back soon.</p>
          </div>
        </Section>
      ) : (
        <>
          <Section className="pt-1">
            <Link
              href={s.nextStep.href}
              className="group relative isolate flex min-h-[16rem] flex-col justify-end overflow-hidden rounded-3xl bg-ink p-4 text-white outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            >
              <Image src={mapArt(map?.level ?? 1, map?.artwork)} alt="" fill priority sizes="(max-width: 430px) 100vw, 430px" className="-z-10 object-cover" />
              <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(10_11_13/0.1)_0%,rgb(10_11_13/0.5)_40%,rgb(10_11_13/0.92)_100%)]" />
              <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold backdrop-blur">Level {map?.level ?? s.currentLevel}</span>
                {active > 0 && <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold backdrop-blur tabular">Step {active} of 4</span>}
              </div>
              <p className="text-xs font-bold text-white/70">Your next move</p>
              <p className="mt-1 font-heading text-2xl leading-tight font-extrabold">{s.nextStep.title}</p>
              <p className="mt-0.5 text-sm text-white/80">{s.nextStep.detail}</p>
              {map && goal && map.state !== "locked" && map.state !== "completed" && <LootMeter tone="dark" total={goal.have} target={goal.target} label={goal.label} className="mt-4" />}
              <span className={cn(buttonVariants({ variant: "gold", size: "pill" }), "mt-4 h-12 w-full text-base")}>
                Continue <ChevronRight className="size-4" aria-hidden />
              </span>
            </Link>
          </Section>

          <Section title={`How to win Level ${map?.level ?? s.currentLevel}`}>
            <ol className="space-y-3">
              {box && (
                <Step
                  n={1}
                  title={`Open ${box.name}`}
                  does={
                    box.locked
                      ? box.lockReason
                      : box.completed
                        ? "Retired: this level's map is complete."
                        : `${formatCredits(box.priceCredits)} Credits per box. Your luck decides what drops.`
                  }
                  status={boxStatus}
                  statusText={box.locked ? "Locked" : undefined}
                  wins={<BoxContents rewards={odds.rewards} loot={odds.loot} />}
                >
                  <div className="mt-3 flex items-center gap-3">
                    <span className="relative size-12 shrink-0 rounded-xl bg-brand-soft">
                      <Image src={boxArt} alt="" fill sizes="48px" unoptimized={/^https?:/.test(boxArt)} className={cn("object-contain p-1", box.locked && "grayscale")} />
                    </span>
                    <Link
                      href={`/play/mystery-box?level=${box.level}`}
                      className={cn(buttonVariants({ variant: boxOpenable ? "gold" : "outline", size: "pill" }), "flex-1")}
                    >
                      {boxOpenable ? (
                        <>
                          <Coins className="size-4" aria-hidden /> Open for {formatCredits(box.priceCredits)}
                        </>
                      ) : (
                        "View Mystery Box"
                      )}
                    </Link>
                  </div>
                  <BoxOddsSheet name={box.name} rewards={odds.rewards} loot={odds.loot} />
                </Step>
              )}

              {map && (
                <Step
                  n={2}
                  title={`Explore ${map.name}`}
                  does={
                    map.state === "locked"
                      ? `Complete Level ${map.prerequisiteLevel} to open this map.`
                      : map.state === "collecting"
                        ? `Collect ${map.lootRequired} Loot to unlock the map. Then Loot fills a chest at each of its ${checkpoints.length} checkpoints.`
                        : `Your Loot fills a chest at each checkpoint. Full chests open the way forward. Loot is never used up.`
                  }
                  status={mapStatus}
                  statusText={map.state === "locked" ? "Locked" : map.state === "exploring" ? `${map.checkpointsDone}/${checkpoints.length} checkpoints` : undefined}
                  wins={
                    <p className="flex items-center gap-2 rounded-2xl border bg-card p-2.5 text-sm">
                      <Flag className="size-4 shrink-0 text-primary" aria-hidden />
                      The final checkpoint reveals a Big Mystery Box, and completing the map opens the next level.
                    </p>
                  }
                >
                  {checkpoints.length > 0 && (
                    <Link href={`/play/map?level=${map.level}`} className="mt-3 block rounded-2xl bg-surface p-3 transition-colors hover:bg-muted">
                      <ol className="flex items-center">
                        {checkpoints.map((c, i) => {
                          const st = checkpointStatus(c);
                          const done = st === "Completed";
                          return (
                            <li key={c.id} className={cn("flex items-center", i > 0 && "flex-1")} aria-label={`${c.name}${c.isFinal ? " (final)" : ""}: ${st}`}>
                              {i > 0 && <span aria-hidden className={cn("mx-1 h-0.5 flex-1 rounded-full", done || st === "Available" ? "bg-primary" : "bg-border")} />}
                              <span
                                aria-hidden
                                className={cn(
                                  "grid shrink-0 place-items-center rounded-full",
                                  c.isFinal ? "size-9" : "size-7",
                                  done && "bg-primary text-primary-foreground",
                                  st === "Available" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                                  st === "Current" && "border-2 border-primary bg-card text-primary",
                                  st === "Locked" && "bg-muted text-muted-foreground",
                                )}
                              >
                                {done ? <Check className="size-3.5" strokeWidth={3} /> : c.isFinal ? <Flag className="size-3.5" /> : st === "Locked" ? <Lock className="size-3" /> : <MapPin className="size-3.5" />}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                      {nextStop && (
                        <p className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate">
                            <span className="text-muted-foreground">{nextStop.isFinal ? "Final stop: " : "Next stop: "}</span>
                            <span className="font-bold">{nextStop.name}</span>
                          </span>
                          <span className="shrink-0 font-semibold text-primary">Open map</span>
                        </p>
                      )}
                    </Link>
                  )}
                </Step>
              )}

              {bigBox && (
                <Step
                  n={3}
                  title="Open the Big Mystery Box"
                  does={
                    bigBox.state === "opened"
                      ? `You found ${bigBox.piecesFound} Puzzle ${bigBox.piecesFound === 1 ? "Piece" : "Pieces"}.`
                      : "Free to open. It appears at the final checkpoint of this map."
                  }
                  status={bigBoxStatus}
                  statusText={bigBox.state === "hidden" ? "At the finish" : undefined}
                  wins={
                    <div className="flex flex-wrap gap-1.5">
                      {bigBoxOdds.map((o) => (
                        <span key={o.pieces} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold tabular">
                          <Puzzle className="size-3.5 text-primary" aria-hidden />
                          {o.pieces} {o.pieces === 1 ? "piece" : "pieces"} <span className="text-muted-foreground">{o.pct}%</span>
                        </span>
                      ))}
                    </div>
                  }
                >
                  {bigBox.state === "available" && (
                    <Link href={`/play/map?level=${map?.level}`} className={cn(buttonVariants({ variant: "gold", size: "pill" }), "mt-3 w-full")}>
                      <Package className="size-4" aria-hidden /> Open Big Mystery Box
                    </Link>
                  )}
                </Step>
              )}

              {puzzle && (
                <Step
                  n={4}
                  title={`Finish the puzzle, spin for the prize`}
                  does={
                    puzzle.attempt
                      ? puzzle.attempt.outcome === "PRIZE"
                        ? `You won ${puzzle.prize.name}.`
                        : `You won ${puzzle.attempt.alternativeDisplay ?? puzzle.alternative.display}.`
                      : `Collect ${puzzle.piecesRequired} Puzzle ${puzzle.piecesRequired === 1 ? "Piece" : "Pieces"}, then spin the prize wheel once.`
                  }
                  status={puzzleStatus}
                  statusText={!puzzle.attempt && !puzzle.canSpin ? `${Math.min(puzzle.piecesHave, puzzle.piecesRequired)}/${puzzle.piecesRequired} pieces` : undefined}
                  wins={
                    <Link href="/play/prizes" className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 transition-colors hover:bg-surface">
                      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-soft text-primary">
                        {puzzle.prize.image ? (
                          <Image src={puzzle.prize.image} alt="" fill sizes="48px" unoptimized={/^https?:/.test(puzzle.prize.image)} className="object-cover" />
                        ) : (
                          <Puzzle className="size-6" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{puzzle.prize.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {s.wheel.active ? `${s.wheel.prizeUnlockPct}% chance, otherwise ${puzzle.alternative.display}` : `Or ${puzzle.alternative.display}`}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  }
                >
                  {!puzzle.attempt && (
                    <Progress value={(Math.min(puzzle.piecesHave, puzzle.piecesRequired) / Math.max(1, puzzle.piecesRequired)) * 100} className="mt-3 h-2" aria-label="Puzzle progress" />
                  )}
                </Step>
              )}
            </ol>
          </Section>

          <Section>
            <details className="group rounded-3xl border bg-card">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-2 px-4 font-semibold">
                View all {s.totalLevels} levels
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
              </summary>
              <div className="space-y-4 border-t p-3">
                <div>
                  <p className="mb-2 px-1 text-xs font-bold text-muted-foreground tabular">
                    Mystery Boxes · {s.unlockedBoxes}/{s.boxes.length} unlocked
                  </p>
                  <LevelTrack levels={boxTrack(s)} active={box?.level} hrefFor={(l) => `/play/mystery-box?level=${l}`} label="Mystery Box levels" />
                </div>
                <div>
                  <p className="mb-2 px-1 text-xs font-bold text-muted-foreground tabular">
                    Maps · {s.completedMaps}/{s.maps.length} completed
                  </p>
                  <LevelTrack levels={mapTrack(s)} active={map?.level} hrefFor={(l) => `/play/map?level=${l}`} label="Map levels" />
                </div>
              </div>
            </details>
          </Section>
        </>
      )}

      <Section>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/collections", icon: BookOpen, title: "Collections", text: "Loot, items, pieces and badges" },
            { href: "/play/mystery-box/history", icon: History, title: "Box History", text: "Every box you've opened" },
          ].map(({ href, icon: Icon, title, text }) => (
            <Link key={href} href={href} className="flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-3 hover:bg-surface">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
