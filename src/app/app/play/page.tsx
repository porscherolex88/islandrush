import { BookOpen, ChevronRight, Coins, History, Puzzle, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LevelTrack } from "@/components/app/adventure/level-track";
import { LootToken } from "@/components/app/adventure/loot";
import { boxTrack, mapTrack } from "@/components/app/adventure/tracks";
import { ART, mapArt } from "@/components/app/art";
import { Section } from "@/components/app/mobile-header";
import { PlayHeader } from "@/components/app/root-page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getAdventureState } from "@/server/services/adventure";
import { getAllFlags } from "@/server/services/config";

export const metadata: Metadata = { title: "Play" };

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-white/85">
        <span>{label}</span>
        <span className="tabular">
          {value}/{total}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={label}>
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#fcd34d,#f59e0b)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function PlayPage() {
  const user = await requireUser();
  const [s, flags] = await Promise.all([getAdventureState(user.id), getAllFlags()]);
  const map = s.currentMap;
  const box = s.currentBox;
  const completedPuzzles = s.puzzles.filter((p) => p.complete).length;
  const nextPuzzle = s.puzzles.find((p) => !p.attempt) ?? null;
  const ready = s.maps.length > 0 && s.boxes.length > 0;

  return (
    <div>
      <PlayHeader level={s.currentLevel} totalLevels={s.totalLevels} href={map ? `/app/play/map?level=${map.level}` : "/app/play"} />

      {!ready ? (
        <Section>
          <div className="rounded-3xl border bg-card p-6 text-center">
            <p className="font-heading text-xl font-extrabold">Your adventure is being prepared</p>
            <p className="mt-1 text-sm text-muted-foreground">New maps and Mystery Boxes are on their way. Check back soon.</p>
          </div>
        </Section>
      ) : (
        <>
          <Section>
            <Link
              href={s.nextStep.href}
              className="group relative isolate block overflow-hidden rounded-[2rem] bg-ocean-deep p-5 text-white outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            >
              <Image src={mapArt(map?.level ?? 1, map?.artwork)} alt="" fill priority sizes="(max-width: 430px) 100vw, 430px" className="-z-10 object-cover object-center brightness-75 transition-transform duration-700 group-hover:scale-105" />
              <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,oklch(0.2_0.04_230/0.35),oklch(0.18_0.04_230/0.9))]" />
              <p className="text-xs font-bold tracking-widest text-amber-200 uppercase">Your adventure</p>
              <p className="font-heading text-4xl leading-tight font-extrabold tabular">
                Level {s.currentLevel}
                <span className="text-2xl text-white/70">/{s.totalLevels}</span>
              </p>
              {map && <p className="text-sm font-semibold text-white/85">Map {map.level}: {map.name}</p>}
              <div className="mt-4 space-y-2.5">
                <Bar label="Mystery Boxes unlocked" value={s.unlockedBoxes} total={s.boxes.length} />
                <Bar label="Maps completed" value={s.completedMaps} total={s.maps.length} />
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/12 p-3 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-amber-200 uppercase">Next unlock</p>
                  <p className="font-heading text-lg leading-tight font-extrabold">{s.nextStep.title}</p>
                  <p className="truncate text-xs text-white/75">{s.nextStep.detail}</p>
                </div>
                <span className={cn(buttonVariants({ variant: "gold", size: "pill" }), "shrink-0")}>
                  Go <ChevronRight className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          </Section>

          <Section title="Mystery Boxes" action={<span className="text-xs font-semibold text-muted-foreground tabular">{s.unlockedBoxes}/{s.boxes.length} unlocked</span>}>
            <LevelTrack levels={boxTrack(s)} active={box?.level} hrefFor={(l) => `/app/play/mystery-box?level=${l}`} label="Mystery Box levels" />
            {box && (
              <Link href={`/app/play/mystery-box?level=${box.level}`} className="mt-3 flex items-center gap-3 rounded-3xl border bg-card p-3 transition-colors hover:bg-surface">
                <Image src={box.artwork ?? ART.crate} alt="" width={72} height={72} unoptimized={/^https?:/.test(box.artwork ?? "")} className="size-18 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-primary">Level {box.level}</p>
                  <p className="font-heading text-lg leading-tight font-extrabold">{box.name}</p>
                  <p className="flex items-center gap-1 text-sm font-semibold tabular">
                    <Coins className="size-4 text-gold" aria-hidden /> {formatCredits(box.priceCredits)} Credits
                  </p>
                </div>
                <span className={cn(buttonVariants({ variant: "gold", size: "pill" }), "shrink-0")}>{flags.mystery_box === false || box.completed ? "View" : "Open"}</span>
              </Link>
            )}
          </Section>

          <Section title="Maps" action={<span className="text-xs font-semibold text-muted-foreground tabular">{s.completedMaps}/{s.maps.length} completed</span>}>
            <LevelTrack levels={mapTrack(s)} active={map?.level} hrefFor={(l) => `/app/play/map?level=${l}`} label="Map levels" />
            {map && (
              <Link href={`/app/play/map?level=${map.level}`} className="mt-3 flex items-center gap-3 rounded-3xl border bg-card p-3 transition-colors hover:bg-surface">
                <span className="relative size-18 shrink-0 overflow-hidden rounded-2xl">
                  <Image src={mapArt(map.level, map.artwork)} alt="" fill sizes="72px" className="object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-primary">Map {map.level}</p>
                  <p className="font-heading text-lg leading-tight font-extrabold">{map.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {map.state === "exploring"
                      ? `${map.checkpointsDone}/${map.checkpoints.length} checkpoints`
                      : map.state === "locked"
                        ? `Complete Map ${map.prerequisiteLevel} first`
                        : map.state === "completed"
                          ? "Completed"
                          : `${Math.min(map.lootCollected, map.lootRequired)}/${map.lootRequired} Loot to unlock`}
                  </p>
                  {map.lootItems.length > 0 && (
                    <span className="mt-1 flex gap-1">
                      {map.lootItems.map((it) => (
                        <LootToken key={it.id} icon={it.icon} rarity={it.rarity} collected={it.collected > 0} size="sm" className="size-7 rounded-lg text-sm" />
                      ))}
                    </span>
                  )}
                </div>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            )}
          </Section>

          <Section title="Puzzles & Prizes">
            <Link href="/app/play/prizes" className="flex items-center gap-3 rounded-3xl border bg-[linear-gradient(135deg,oklch(0.98_0.03_85),oklch(0.95_0.05_80))] p-4 transition-colors hover:brightness-[1.02]">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-amber-600 ring-2 ring-amber-200">
                <Puzzle className="size-7" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-lg leading-tight font-extrabold">
                  {s.totalPieces} Puzzle {s.totalPieces === 1 ? "Piece" : "Pieces"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {completedPuzzles}/{s.puzzles.length} puzzles complete
                  {nextPuzzle ? ` · Next prize: ${nextPuzzle.prize.name}` : ""}
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </Section>
        </>
      )}

      <Section title="More">
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/app/collections", icon: BookOpen, title: "Collections", text: "Your collection book" },
            { href: "/app/play/mystery-box/history", icon: History, title: "Box History", text: "Every box you've opened" },
            { href: "/app/play/prizes", icon: Trophy, title: "Prizes", text: "Puzzles and prize claims" },
          ].map(({ href, icon: Icon, title, text }) => (
            <Link key={href} href={href} className="flex min-h-24 flex-col justify-between rounded-2xl border bg-card p-4 hover:bg-surface">
              <span className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
