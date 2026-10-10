import { BarChart3, Check, ChevronRight, Gem, Lock, Puzzle, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LootToken } from "@/components/app/adventure/loot";
import { mapArt, Token } from "@/components/app/art";
import { Section } from "@/components/app/mobile-header";
import { ProgressHeader } from "@/components/app/root-page-header";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getProgress } from "@/server/queries/progress";
import { getAdventureState, type AdventureMapView, type PuzzleView } from "@/server/services/adventure";

export const metadata: Metadata = { title: "Collection" };

function MapLoot({ map, current }: { map: AdventureMapView; current: boolean }) {
  const locked = map.state === "locked";
  const found = map.lootItems.filter((i) => i.collected > 0).length;
  return (
    <div className={cn("rounded-2xl border bg-card p-3", current && "border-primary/40 ring-1 ring-primary/20")}>
      <div className="flex items-center gap-3">
        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-ocean-deep">
          <Image src={mapArt(map.level, map.artwork)} alt="" fill sizes="44px" className={cn("object-cover", locked && "opacity-40 grayscale")} />
          {locked && (
            <span className="absolute inset-0 grid place-items-center">
              <Lock className="size-4 text-white" aria-hidden />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{map.name}</p>
          <p className="text-xs text-muted-foreground tabular">Adventure Level {map.level}</p>
        </div>
        <span className={cn("shrink-0 text-xs font-bold tabular", map.state === "completed" ? "text-success" : "text-muted-foreground")}>
          {map.state === "completed" ? (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5" strokeWidth={3} aria-hidden /> Complete
            </span>
          ) : (
            `${found}/${map.lootItems.length} found`
          )}
        </span>
      </div>
      {map.lootItems.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {map.lootItems.map((it) => {
            const has = it.collected > 0;
            return (
              <li key={it.id} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl p-2", has ? "bg-surface" : "bg-muted/40")}>
                <LootToken icon={it.icon} rarity={it.rarity} collected={has} />
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-semibold", !has && "text-muted-foreground")}>{has ? it.name : "Not found yet"}</span>
                  <span className="block text-xs font-bold text-muted-foreground tabular">× {it.collected.toLocaleString("en-MY")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PuzzleRow({ p }: { p: PuzzleView }) {
  const have = Math.min(p.piecesHave, p.piecesRequired);
  return (
    <Link href="/app/play/prizes" className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:bg-surface">
      <span className={cn("relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl", have > 0 ? "bg-gold-soft text-gold-foreground" : "bg-muted text-muted-foreground")}>
        {p.image ? <Image src={p.image} alt="" fill sizes="48px" unoptimized={/^https?:/.test(p.image)} className={cn("object-cover", have === 0 && "opacity-40 grayscale")} /> : <Puzzle className="size-6" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{p.name}</p>
        <p className="truncate text-xs text-muted-foreground">Prize: {p.prize.name}</p>
        <div className="mt-1.5 flex gap-1" aria-label={`${have} of ${p.piecesRequired} pieces`}>
          {Array.from({ length: p.piecesRequired }, (_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < have ? (p.complete ? "bg-success" : "bg-amber-500") : "bg-muted")} />
          ))}
        </div>
      </div>
      <span className={cn("text-sm font-bold tabular", p.complete ? "text-success" : have === 0 && "text-muted-foreground")}>
        {have}/{p.piecesRequired}
      </span>
    </Link>
  );
}

export default async function ProgressPage() {
  const user = await requireUser();
  const [p, adventure] = await Promise.all([getProgress(user), getAdventureState(user.id)]);

  const allLoot = adventure.maps.flatMap((m) => m.lootItems);
  const lootFound = allLoot.filter((i) => i.collected > 0).length;
  const lootTotalCount = allLoot.reduce((n, i) => n + i.collected, 0);
  const shownMaps = adventure.maps.filter((m) => m.state !== "locked" || m.id === adventure.currentMap?.id);
  const lockedMaps = adventure.maps.filter((m) => !shownMaps.includes(m));
  const puzzlesDone = adventure.puzzles.filter((x) => x.complete).length;
  const startedPuzzles = adventure.puzzles.filter((x) => x.complete || x.piecesHave > 0);
  const upcomingPuzzles = adventure.puzzles.filter((x) => !startedPuzzles.includes(x));

  const earned = p.achievements.filter((a) => a.earnedAt).length;
  const achievementsSorted = [...p.achievements].sort((a, b) => {
    if (Boolean(a.earnedAt) !== Boolean(b.earnedAt)) return a.earnedAt ? -1 : 1;
    return b.current / Math.max(1, b.threshold) - a.current / Math.max(1, a.threshold);
  });
  const stats: { label: string; value: number; suffix?: string }[] = [
    ...p.stats.map((s) => ({ label: s.label, value: s.value, suffix: s.condition === "STREAK_DAYS" ? " days" : undefined })),
    { label: "Maps completed", value: adventure.completedMaps },
    { label: "Checkpoints reached", value: adventure.maps.reduce((n, m) => n + m.checkpointsDone, 0) },
  ];

  return (
    <div className="pb-4">
      <ProgressHeader
        lootFound={lootFound}
        lootTotal={allLoot.length}
        pieces={adventure.totalPieces}
        puzzlesDone={puzzlesDone}
        puzzlesTotal={adventure.puzzles.length}
        earned={earned}
        achievements={p.achievements.length}
      />

      <Section
        id="loot"
        className="scroll-mt-20"
        title={
          <>
            <Gem className="size-5 text-primary" aria-hidden /> Loot
          </>
        }
        action={<span className="text-sm font-bold text-muted-foreground tabular">{lootTotalCount.toLocaleString("en-MY")} collected</span>}
      >
        <p className="-mt-1 mb-3 text-sm text-muted-foreground">Every Mystery Box drops Loot for its map. Loot fills the chests that move you between checkpoints.</p>
        <div className="space-y-2">
          {shownMaps.map((m) => (
            <MapLoot key={m.id} map={m} current={m.id === adventure.currentMap?.id} />
          ))}
        </div>
        {lockedMaps.length > 0 && (
          <details className="group mt-2">
            <summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold text-primary hover:bg-brand-soft">
              <span className="group-open:hidden">Show {lockedMaps.length} locked maps</span>
              <span className="hidden group-open:inline">Hide locked maps</span>
            </summary>
            <div className="mt-2 space-y-2">
              {lockedMaps.map((m) => (
                <MapLoot key={m.id} map={m} current={false} />
              ))}
            </div>
          </details>
        )}
      </Section>

      <Section
        id="pieces"
        className="scroll-mt-20"
        title={
          <>
            <Puzzle className="size-5 text-gold" aria-hidden /> Puzzle pieces
          </>
        }
        action={
          <Link href="/app/play/prizes" className="flex h-11 items-center text-sm font-semibold text-primary">
            Prizes
          </Link>
        }
      >
        <p className="-mt-1 mb-3 text-sm text-muted-foreground">
          You have <strong className="text-foreground tabular">{adventure.totalPieces}</strong> {adventure.totalPieces === 1 ? "piece" : "pieces"}. They come from the Big Mystery Box at the end of each map and fill puzzles in order.
        </p>
        <div className="space-y-2">
          {startedPuzzles.map((x) => (
            <PuzzleRow key={x.id} p={x} />
          ))}
          {startedPuzzles.length === 0 && <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Finish your first map to open a Big Mystery Box and find puzzle pieces.</p>}
        </div>
        {upcomingPuzzles.length > 0 && (
          <details className="group mt-2">
            <summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold text-primary hover:bg-brand-soft">
              <span className="group-open:hidden">Show {upcomingPuzzles.length} more puzzles</span>
              <span className="hidden group-open:inline">Hide upcoming puzzles</span>
            </summary>
            <div className="mt-2 space-y-2">
              {upcomingPuzzles.map((x) => (
                <PuzzleRow key={x.id} p={x} />
              ))}
            </div>
          </details>
        )}
      </Section>

      <Section
        id="achievements"
        className="scroll-mt-20"
        title={
          <>
            <Trophy className="size-5 text-gold" aria-hidden /> Achievements
          </>
        }
        action={
          <span className="text-sm font-bold text-muted-foreground tabular">
            {earned} / {p.achievements.length}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {achievementsSorted.map((a) => {
            const pct = Math.round((Math.min(a.current, a.threshold) / Math.max(1, a.threshold)) * 100);
            return (
              <div key={a.id} className={cn("flex flex-col gap-2 rounded-2xl border p-3", a.earnedAt ? "border-gold/40 bg-gold-soft/70" : "bg-card")}>
                <Token icon={a.badgeIcon} rarity={a.earnedAt ? "LEGENDARY" : "COMMON"} owned={Boolean(a.earnedAt) || a.current > 0} size="md" />
                <div>
                  <p className="text-sm leading-tight font-bold">{a.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
                </div>
                {a.earnedAt ? (
                  <p className="mt-auto text-xs font-bold text-gold-foreground">Earned</p>
                ) : (
                  <div className="mt-auto">
                    <Progress value={pct} className="h-1.5" indicatorClassName="bg-amber-500" aria-label={`${a.name} progress`} />
                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground tabular">
                      {Math.min(a.current, a.threshold)} / {a.threshold}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section>
        <details className="rounded-2xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-sm font-semibold">
            <BarChart3 className="size-4 text-primary" aria-hidden /> Your stats
            <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
          </summary>
          <dl className="grid grid-cols-2 gap-2 border-t p-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-surface p-3">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="font-heading text-xl font-extrabold tabular">
                  {s.value.toLocaleString("en-MY")}
                  {s.suffix ?? ""}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </Section>
    </div>
  );
}
