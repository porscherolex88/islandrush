import { BookOpen, Check, ChevronRight, Coins, History, Lock, MapPin, Puzzle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LevelTrack } from "@/components/app/adventure/level-track";
import { LootMeter, LootToken } from "@/components/app/adventure/loot";
import { boxTrack, mapLootGoal, mapTrack } from "@/components/app/adventure/tracks";
import { ART, mapArt } from "@/components/app/art";
import { Section } from "@/components/app/mobile-header";
import { PlayHeader } from "@/components/app/root-page-header";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getAdventureState, type AdventureState } from "@/server/services/adventure";
import { getAllFlags } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Play" };

const LOOP = ["Box", "Loot", "Map", "Checkpoints", "Big Box", "Puzzle", "Prize"] as const;

/** Which step of the Box → Prize loop the player is on right now. */
function loopStage(s: AdventureState) {
  const map = s.currentMap;
  switch (s.nextStep.kind) {
    case "claim":
    case "wheel":
      return 6;
    case "bigbox":
      return 4;
    case "checkpoint":
      return 3;
    case "map":
      return 2;
    case "loot":
      return map?.state === "exploring" ? 3 : 1;
    default:
      return map?.state === "completed" ? 5 : 0;
  }
}

function checkpointStatus(c: { state: string; isNext: boolean }) {
  if (c.state === "completed") return "Completed";
  if (c.state === "available") return "Available";
  return c.isNext ? "Current" : "Locked";
}

export default async function PlayPage() {
  const user = await requireUser();
  const [s, flags, balances] = await Promise.all([getAdventureState(user.id), getAllFlags(), getBalances(user.id)]);
  const map = s.currentMap;
  const box = s.currentBox;
  const ready = s.maps.length > 0 && s.boxes.length > 0;
  const stage = loopStage(s);
  const puzzle = s.puzzles.find((p) => p.level === s.currentLevel) ?? s.puzzles.find((p) => !p.complete) ?? null;
  const checkpoints = map ? [...map.checkpoints].sort((a, b) => Number(a.isFinal) - Number(b.isFinal) || a.position - b.position) : [];
  const goal = map ? mapLootGoal(map) : null;
  const boxOpenable = box && !box.locked && !box.completed && flags.mystery_box !== false;

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
              className="group relative isolate block overflow-hidden rounded-3xl bg-ocean-deep text-white outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            >
              <div className="relative h-40">
                <Image src={mapArt(map?.level ?? 1, map?.artwork)} alt="" fill priority sizes="(max-width: 430px) 100vw, 430px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,oklch(0.2_0.04_230/0.9))]" />
                {map && (map.state === "exploring" || map.state === "completed") && checkpoints.length > 0 && (
                  <p className="absolute bottom-3 left-4 flex items-center gap-1 text-xs font-bold tracking-widest text-amber-200 uppercase tabular">
                    <MapPin className="size-3.5" aria-hidden />
                    {map.state === "completed" ? "Map complete" : `${map.checkpointsDone} of ${checkpoints.length} checkpoints`}
                  </p>
                )}
              </div>
              <div className="space-y-3 bg-[oklch(0.2_0.04_230)] p-4 pt-2">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-white/60 uppercase">Next objective</p>
                  <p className="font-heading text-xl leading-tight font-extrabold">{s.nextStep.title}</p>
                  <p className="text-sm text-white/75">{s.nextStep.detail}</p>
                </div>
                {map && goal && map.state !== "locked" && map.state !== "completed" && <LootMeter tone="dark" total={goal.have} target={goal.target} label={goal.label} />}
                <span className={cn(buttonVariants({ variant: "gold", size: "pill" }), "h-12 w-full text-base")}>
                  Continue <ChevronRight className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          </Section>

          <Section>
            <ol aria-label="How the adventure works" className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1 rounded-2xl border bg-card px-2 py-2">
              {LOOP.map((step, i) => (
                <li key={step} className="flex items-center gap-0.5">
                  <span
                    aria-current={i === stage ? "step" : undefined}
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap",
                      i < stage && "text-success",
                      i === stage && "bg-primary text-primary-foreground",
                      i > stage && "text-muted-foreground",
                    )}
                  >
                    {step}
                  </span>
                  {i < LOOP.length - 1 && <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden />}
                </li>
              ))}
            </ol>
          </Section>

          {box && (
            <Section title="Mystery Box">
              <div className="rounded-3xl border bg-card p-3">
                <div className="flex items-center gap-3">
                  <Image src={box.artwork ?? ART.crate} alt="" width={72} height={72} unoptimized={/^https?:/.test(box.artwork ?? "")} className={cn("size-18 rounded-2xl object-cover", box.locked && "grayscale")} />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-lg leading-tight font-extrabold">{box.name}</p>
                    <p className="text-xs text-muted-foreground">{box.locked ? box.lockReason : box.completed ? "Retired: its map is complete" : `Find ${map?.name ?? ""} Loot`}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold tabular">
                      <Coins className="size-4 text-gold" aria-hidden /> {formatCredits(box.priceCredits)} Credits
                    </p>
                  </div>
                </div>
                {map && map.lootItems.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5">
                    {map.lootItems.map((it) => (
                      <LootToken key={it.id} icon={it.icon} rarity={it.rarity} collected={it.collected > 0} size="sm" className="size-8 rounded-lg text-sm" />
                    ))}
                    <span className="ml-1 text-xs text-muted-foreground">Primary Loot</span>
                  </div>
                )}
                <Link href={`/app/play/mystery-box?level=${box.level}`} className={cn(buttonVariants({ variant: boxOpenable ? "gold" : "outline", size: "pill" }), "mt-3 w-full")}>
                  {boxOpenable ? "Open Mystery Box" : "View Mystery Box"}
                </Link>
              </div>
            </Section>
          )}

          {map && checkpoints.length > 0 && (
            <Section
              title="Map progress"
              action={
                <Link href={`/app/play/map?level=${map.level}`} className="flex h-11 items-center text-sm font-semibold text-primary">
                  Open map
                </Link>
              }
            >
              <Link href={`/app/play/map?level=${map.level}`} className="block rounded-3xl border bg-card p-4 transition-colors hover:bg-surface">
                <p className="text-sm font-semibold text-muted-foreground tabular">
                  {map.state === "exploring" || map.state === "completed" ? `${map.checkpointsDone} of ${checkpoints.length} checkpoints` : map.state === "locked" ? `Complete Adventure Level ${map.prerequisiteLevel} first` : "Collect Loot to unlock this map"}
                </p>
                <ol className="mt-3 space-y-0">
                  {checkpoints.map((c, i) => {
                    const status = checkpointStatus(c);
                    const done = status === "Completed";
                    const live = status === "Available" || status === "Current";
                    return (
                      <li key={c.id} className="relative flex items-center gap-3 pb-3 last:pb-0">
                        {i < checkpoints.length - 1 && <span aria-hidden className={cn("absolute top-8 left-[15px] h-[calc(100%-1.5rem)] w-0.5", done ? "bg-success/60" : "bg-border")} />}
                        <span
                          className={cn(
                            "relative grid size-8 shrink-0 place-items-center rounded-full",
                            done && "bg-success text-white",
                            status === "Available" && "bg-gold text-white ring-4 ring-gold/25",
                            status === "Current" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                            status === "Locked" && "bg-muted text-muted-foreground",
                          )}
                          aria-hidden
                        >
                          {done ? <Check className="size-4" strokeWidth={3} /> : status === "Locked" ? <Lock className="size-3.5" /> : <MapPin className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-sm font-bold", !done && !live && "text-muted-foreground")}>{c.isFinal ? `${c.name} (final)` : c.name}</span>
                        </span>
                        <span className={cn("text-xs font-semibold", done ? "text-success" : status === "Available" ? "text-gold-foreground" : status === "Current" ? "text-primary" : "text-muted-foreground")}>{status}</span>
                      </li>
                    );
                  })}
                </ol>
              </Link>
            </Section>
          )}

          {puzzle && (
            <Section title="Prize puzzle">
              <Link href="/app/play/prizes" className="flex items-center gap-3 rounded-3xl border bg-[linear-gradient(135deg,oklch(0.98_0.03_85),oklch(0.95_0.05_80))] p-4 transition-colors hover:brightness-[1.02]">
                <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-amber-600 ring-2 ring-amber-200">
                  {puzzle.image ? <Image src={puzzle.image} alt="" fill sizes="56px" unoptimized={/^https?:/.test(puzzle.image)} className="object-cover" /> : <Puzzle className="size-7" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-base leading-tight font-extrabold">{puzzle.name}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    {Math.min(puzzle.piecesHave, puzzle.piecesRequired)} / {puzzle.piecesRequired} pieces
                  </p>
                  <Progress value={(Math.min(puzzle.piecesHave, puzzle.piecesRequired) / Math.max(1, puzzle.piecesRequired)) * 100} className="mt-1.5 h-1.5 bg-white" indicatorClassName="bg-amber-500" aria-hidden />
                  <p className="mt-1 truncate text-xs">
                    {puzzle.complete ? "Puzzle complete: prize unlock ready" : `Complete it to reach the prize unlock: ${puzzle.prize.name}`}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </Section>
          )}

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
                  <LevelTrack levels={boxTrack(s)} active={box?.level} hrefFor={(l) => `/app/play/mystery-box?level=${l}`} label="Mystery Box levels" />
                </div>
                <div>
                  <p className="mb-2 px-1 text-xs font-bold text-muted-foreground tabular">
                    Maps · {s.completedMaps}/{s.maps.length} completed
                  </p>
                  <LevelTrack levels={mapTrack(s)} active={map?.level} hrefFor={(l) => `/app/play/map?level=${l}`} label="Map levels" />
                </div>
              </div>
            </details>
          </Section>
        </>
      )}

      <Section>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/app/progress", icon: BookOpen, title: "Your collection", text: "Loot, puzzle pieces and achievements" },
            { href: "/app/play/mystery-box/history", icon: History, title: "Box History", text: "Every box you've opened" },
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
