import { BookOpen, Check, ChevronRight, Gift, History, Lock, Puzzle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LevelTrack } from "@/components/app/adventure/level-track";
import { LootMeter } from "@/components/app/adventure/loot";
import { BoxContents, BoxPrizesSheet } from "@/components/app/adventure/prizes-list";
import { defaultBox, boxTrack, mapLootGoal, mapTrack } from "@/components/app/adventure/tracks";
import { boxArt, mapArt } from "@/components/app/art";
import { Section } from "@/components/app/mobile-header";
import { PlayHeader } from "@/components/app/root-page-header";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { cn } from "@/lib/utils";
import { adventureBoxPrizes, getAdventureState, type AdventureState } from "@/server/services/adventure";
import { getAllFlags } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Play" };

type StepState = "now" | "done" | "locked" | "next";

/** Which of the three steps (Box, Map, Puzzle) the player's next objective belongs to. */
function activeStep(s: AdventureState) {
  switch (s.nextStep.kind) {
    case "claim":
    case "wheel":
      return 3;
    case "map":
    case "checkpoint":
    case "bigbox":
      return 2;
    case "loot":
      return 1;
    default:
      return 0;
  }
}

function Step({
  n,
  title,
  art,
  state,
  line,
  href,
  cta,
  children,
}: {
  n: number;
  title: string;
  art: string;
  state: StepState;
  line: string;
  href: string;
  cta?: string;
  children: ReactNode;
}) {
  const now = state === "now";
  return (
    <li aria-current={now ? "step" : undefined} className="rounded-3xl border bg-card p-3">
      <div className="flex items-center gap-3">
        <span className="relative size-14 shrink-0">
          <Image src={art} alt="" fill sizes="56px" className={cn("object-contain", state === "locked" && "opacity-50 grayscale")} />
          <span
            aria-hidden
            className={cn(
              "absolute -top-1 -left-1 grid size-6 place-items-center rounded-full text-xs font-extrabold ring-2 ring-card",
              state === "done" ? "bg-success text-white" : now ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : state === "locked" ? <Lock className="size-3" /> : n}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg leading-tight font-extrabold">{title}</h3>
          <p className="truncate text-sm text-muted-foreground tabular">{line}</p>
        </div>
        <Link
          href={href}
          aria-label={cta ? undefined : `Go to ${title}`}
          className={cn(buttonVariants({ variant: now ? "gold" : "outline", size: "pill" }), "shrink-0", !cta && "w-11 px-0")}
        >
          {cta ?? <ChevronRight className="size-4" aria-hidden />}
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </li>
  );
}

export default async function PlayPage() {
  const user = await requireUser();
  const [s, flags, balances] = await Promise.all([getAdventureState(user.id), getAllFlags(), getBalances(user.id)]);
  const map = s.currentMap;
  const box = defaultBox(s, Number(balances.CREDITS));
  const ready = s.maps.length > 0 && s.boxes.length > 0;
  const prizes = box ? await adventureBoxPrizes(box.id) : { rewards: [], loot: [] };
  const active = activeStep(s);
  const puzzle = s.puzzles.find((p) => p.level === s.currentLevel) ?? s.puzzles.find((p) => !p.complete) ?? null;
  const goal = map ? mapLootGoal(map) : null;
  const boxOpenable = Boolean(box && !box.locked && flags.mystery_box !== false);
  const level = map?.level ?? s.currentLevel;
  const pieces = puzzle ? Math.min(puzzle.piecesHave, puzzle.piecesRequired) : 0;
  const cpTotal = map?.checkpoints.length ?? 0;
  const bigBoxPieces = map?.bigBox?.pieces ?? [];

  const state = (n: number, done: boolean, locked: boolean): StepState => (done ? "done" : n === active ? "now" : locked ? "locked" : "next");
  const boxState = state(1, false, Boolean(box?.locked));
  const mapState = state(2, map?.state === "completed", map?.state === "locked");
  const puzzleState = state(3, Boolean(puzzle?.attempt), false);

  return (
    <div className="pb-4">
      <PlayHeader level={s.currentLevel} totalLevels={s.totalLevels} mapName={map?.name ?? null} credits={balances.CREDITS} />

      {!ready ? (
        <Section>
          <div className="rounded-3xl border bg-card p-6 text-center">
            <p className="font-heading text-xl font-extrabold">Your adventure is being prepared</p>
            <p className="mt-1 text-sm text-muted-foreground">New maps and Mystery Boxes are on their way.</p>
          </div>
        </Section>
      ) : (
        <>
          <Section className="pt-1">
            <Link
              href={s.nextStep.href}
              className="relative isolate flex min-h-48 flex-col justify-end overflow-hidden rounded-3xl bg-ink p-4 text-white outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            >
              <Image src={mapArt(level, map?.artwork)} alt="" fill priority sizes="(max-width: 430px) 100vw, 430px" className="-z-10 object-cover" />
              <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(10_11_13/0)_0%,rgb(10_11_13/0.55)_45%,rgb(10_11_13/0.92)_100%)]" />
              <p className="text-xs font-bold text-white/70">{active ? `Step ${active} of 3 · Next move` : "Next move"}</p>
              <p className="font-heading text-2xl leading-tight font-extrabold">{s.nextStep.title}</p>
              {map && goal && map.state !== "locked" && map.state !== "completed" && <LootMeter tone="dark" total={goal.have} target={goal.target} label={goal.label} className="mt-3" />}
              <span className={cn(buttonVariants({ variant: "gold", size: "pill" }), "mt-3 h-12 w-full text-base")}>
                Continue <ChevronRight className="size-4" aria-hidden />
              </span>
            </Link>
          </Section>

          <Section title="3 steps to win">
            <ol className="space-y-3">
              {box && (
                <Step
                  n={1}
                  title="Box"
                  art={boxArt(box.level, box.artwork)}
                  state={boxState}
                  line={box.locked ? "Locked" : `${box.name} · ${formatCredits(box.priceCredits)} Credits`}
                  href={`/play/mystery-box?level=${box.level}`}
                  cta={boxOpenable ? "Open" : undefined}
                >
                  <BoxContents compact rewards={prizes.rewards} loot={prizes.loot} />
                  <BoxPrizesSheet
                    name={box.name}
                    rewards={prizes.rewards}
                    loot={prizes.loot}
                    trigger={
                      <button type="button" className="mt-1 flex h-9 w-full items-center justify-center text-xs font-semibold text-primary">
                        All prizes
                      </button>
                    }
                  />
                </Step>
              )}

              {map && (
                <Step
                  n={2}
                  title="Map"
                  art="/illustrations/3d/map-scroll.webp"
                  state={mapState}
                  line={
                    map.state === "locked"
                      ? "Locked"
                      : map.state === "completed"
                        ? "Done"
                        : map.state === "exploring"
                          ? `${map.name} · ${map.checkpointsDone}/${cpTotal} checkpoints`
                          : `${map.name} · ready to unlock`
                  }
                  href={`/play/map?level=${map.level}`}
                  cta={active === 2 ? "Go" : undefined}
                >
                  <div className="flex items-center gap-2.5 rounded-2xl bg-surface p-2.5">
                    <Gift className="size-5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-bold">Big Box</span>
                      <span className="text-muted-foreground"> at the finish</span>
                    </span>
                    {bigBoxPieces.length > 0 && (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-bold tabular">
                        <Puzzle className="size-3.5 text-primary" aria-hidden />
                        {Math.min(...bigBoxPieces)}-{Math.max(...bigBoxPieces)} pieces
                      </span>
                    )}
                  </div>
                </Step>
              )}

              {puzzle && (
                <Step
                  n={3}
                  title="Puzzle"
                  art="/illustrations/3d/puzzle.webp"
                  state={puzzleState}
                  line={puzzle.attempt ? "Done" : puzzle.canSpin ? "Complete: spin for your prize" : `${pieces}/${puzzle.piecesRequired} pieces`}
                  href="/play/prizes"
                  cta={puzzle.canSpin ? "Spin" : active === 3 ? "Claim" : undefined}
                >
                  <div className="flex items-center gap-3 rounded-2xl bg-gold-soft p-2.5">
                    <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-card text-gold-foreground">
                      {puzzle.prize.image ? (
                        <Image src={puzzle.prize.image} alt="" fill sizes="48px" unoptimized={/^https?:/.test(puzzle.prize.image)} className="object-cover" />
                      ) : (
                        <Gift className="size-6" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-muted-foreground">Big prize</span>
                      <span className="block truncate font-heading text-base leading-tight font-extrabold">{puzzle.prize.name}</span>
                    </span>
                  </div>
                  {!puzzle.attempt && <Progress value={(pieces / Math.max(1, puzzle.piecesRequired)) * 100} className="mt-2.5 h-2" aria-label="Puzzle pieces" />}
                </Step>
              )}
            </ol>
          </Section>

          <Section>
            <details className="group rounded-3xl border bg-card">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 text-sm font-semibold">
                All {s.totalLevels} levels
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
              </summary>
              <div className="space-y-4 border-t p-3">
                <div>
                  <p className="mb-2 px-1 text-xs font-bold text-muted-foreground tabular">
                    Mystery Boxes · {s.unlockedBoxes}/{s.boxes.length}
                  </p>
                  <LevelTrack levels={boxTrack(s)} active={box?.level} hrefFor={(l) => `/play/mystery-box?level=${l}`} label="Mystery Box levels" />
                </div>
                <div>
                  <p className="mb-2 px-1 text-xs font-bold text-muted-foreground tabular">
                    Maps · {s.completedMaps}/{s.maps.length}
                  </p>
                  <LevelTrack levels={mapTrack(s)} active={map?.level} hrefFor={(l) => `/play/map?level=${l}`} label="Map levels" />
                </div>
              </div>
            </details>
          </Section>
        </>
      )}

      <Section>
        <div className="flex gap-2">
          {[
            { href: "/collections", icon: BookOpen, title: "Collections" },
            { href: "/play/mystery-box/history", icon: History, title: "Box history" },
          ].map(({ href, icon: Icon, title }) => (
            <Link key={href} href={href} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border bg-card text-sm font-semibold hover:bg-surface">
              <Icon className="size-4 text-primary" aria-hidden />
              {title}
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
