"use client";

import { motion, useReducedMotion } from "motion/react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatCredits } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { discoverTileAction, unlockAreaAction } from "@/server/actions/games";
import type { RewardResult } from "@/server/services/rewards";
import { RequirementList, type RequirementView } from "./requirement-list";
import { RewardReveal } from "./reward-reveal";

export type TileView = { id: string; row: number; col: number; name: string; icon: string; discovered: boolean; reward: RewardResult | null; cost: number };
export type AreaViewModel = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isSpecial: boolean;
  accessible: boolean;
  canUnlock: boolean;
  gridCols: number;
  requirements: RequirementView[];
  tiles: TileView[];
  discoveredCount: number;
};

const PIN_LAYOUT = [
  { x: 22, y: 70 },
  { x: 60, y: 56 },
  { x: 32, y: 34 },
  { x: 70, y: 22 },
  { x: 50, y: 82 },
  { x: 80, y: 44 },
];

/** Island overview with an interactive pin for each area. */
function IslandOverview({ areas, selected, onSelect }: { areas: AreaViewModel[]; selected: string; onSelect: (id: string) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_30%_20%,#bae6fd,#7dd3fc_45%,#38bdf8)]">
      <svg viewBox="0 0 400 300" className="absolute inset-0 size-full" aria-hidden>
        <path d="M60 230 C 30 170, 80 110, 140 90 C 190 40, 290 40, 330 90 C 380 140, 360 220, 300 250 C 240 285, 110 280, 60 230 Z" fill="#fde68a" />
        <path d="M80 222 C 60 175, 100 125, 150 108 C 195 65, 280 65, 315 105 C 350 145, 335 210, 290 235 C 235 262, 120 262, 80 222 Z" fill="#86efac" />
        <path d="M150 150 C 170 120, 230 110, 260 140 C 280 170, 240 200, 200 195 C 170 192, 140 180, 150 150 Z" fill="#4ade80" opacity="0.7" />
        <path d="M120 200 Q 180 170 210 150 T 290 90" stroke="#a16207" strokeWidth="3" strokeDasharray="6 7" fill="none" opacity="0.55" />
      </svg>
      {areas.map((a, i) => {
        const pos = PIN_LAYOUT[i % PIN_LAYOUT.length];
        const complete = a.accessible && a.discoveredCount === a.tiles.length && a.tiles.length > 0;
        return (
          <motion.button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            aria-pressed={selected === a.id}
            aria-label={`${a.name}${a.accessible ? `, ${a.discoveredCount} of ${a.tiles.length} tiles discovered` : ", locked"}`}
            animate={reduce || selected !== a.id ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border-2 bg-white px-2 py-1 text-xs font-bold shadow-card whitespace-nowrap",
                selected === a.id ? "border-primary text-primary" : "border-white text-foreground",
                !a.accessible && "bg-white/85 text-muted-foreground",
              )}
            >
              <span aria-hidden className="text-base">
                {a.accessible ? a.icon : "🔒"}
              </span>
              {a.name}
              {a.isSpecial && <Sparkles className="size-3 text-amber-500" aria-hidden />}
              {complete && <span aria-hidden>✅</span>}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function MapTile({
  tile,
  color,
  selected,
  discovering,
  onSelect,
}: {
  tile: TileView;
  color: string;
  selected: boolean;
  discovering: boolean;
  onSelect: () => void;
}) {
  const reduce = useReducedMotion();
  if (tile.discovered && tile.reward) {
    const r = rarityOf(tile.reward.rarity);
    return (
      <motion.div
        className={cn("grid aspect-square place-items-center rounded-xl text-2xl ring-2", r.bg, r.ring)}
        initial={reduce ? false : { scale: 0.6, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
        title={`${tile.name}: ${tile.reward.display}`}
      >
        <span aria-hidden>{tile.reward.icon}</span>
        <span className="sr-only">
          {tile.name}: {tile.reward.display}
        </span>
      </motion.div>
    );
  }
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={discovering}
      aria-pressed={selected}
      aria-label={`${tile.name}, undiscovered`}
      className={cn(
        "relative grid aspect-square place-items-center overflow-hidden rounded-xl text-xl font-black text-white/90 shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        selected && "ring-4 ring-gold",
      )}
      style={{ background: `linear-gradient(145deg, color-mix(in oklch, ${color}, white 15%), color-mix(in oklch, ${color}, black 20%))` }}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      animate={reduce ? undefined : discovering && selected ? { scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] } : { scale: 1 }}
      transition={discovering && selected ? { duration: 0.6, repeat: Infinity } : undefined}
    >
      <span aria-hidden>?</span>
      <span className="shimmer absolute inset-0 opacity-30" aria-hidden />
    </motion.button>
  );
}

export function LockedArea({ area }: { area: AreaViewModel }) {
  const router = useRouter();
  const [reveal, setReveal] = useState<{ rewards: RewardResult[]; xp: number; title: string } | null>(null);
  const { run, pending } = useAction(unlockAreaAction, {
    refresh: false,
    onSuccess: (d) => setReveal({ rewards: d.rewards, xp: d.xp, title: `${d.areaIcon} ${d.areaName} unlocked` }),
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm">
        <Lock className="size-4 text-muted-foreground" aria-hidden />
        <span>{area.isSpecial ? "This Special Area is sealed. Meet every requirement to open it." : "Meet these requirements to open this area."}</span>
      </div>
      <RequirementList requirements={area.requirements} />
      <Button size="xl" className="w-full" variant={area.canUnlock ? "gold" : "secondary"} disabled={!area.canUnlock || pending} onClick={() => run(area.id)}>
        {pending && <Loader2 className="animate-spin" />}
        {area.canUnlock ? `Unlock ${area.name}` : "Requirements not met yet"}
      </Button>
      <RewardReveal
        open={Boolean(reveal)}
        onClose={() => {
          setReveal(null);
          router.refresh();
        }}
        title={reveal?.title}
        rewards={reveal?.rewards ?? []}
        xp={reveal?.xp}
        note={area.isSpecial ? "A Special Area is now open on your map." : "A new area is open to explore."}
      />
    </div>
  );
}

export function MapArea({ area, freeLeft, credits }: { area: AreaViewModel; freeLeft: number; credits: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ reward: RewardResult; xp: number; areaCompleted: boolean } | null>(null);
  const tile = area.tiles.find((t) => t.id === selected);
  const { run, pending } = useAction(discoverTileAction, {
    refresh: false,
    onSuccess: (d) => {
      setReveal({ reward: d.reward, xp: d.xp, areaCompleted: d.areaCompleted });
      setSelected(null);
    },
  });
  const free = freeLeft > 0 && (tile?.cost ?? 0) > 0;
  const cost = tile?.cost ?? 0;
  const affordable = free || cost === 0 || credits >= cost;
  const allFound = area.discoveredCount === area.tiles.length;

  return (
    <div className="space-y-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${area.gridCols}, minmax(0, 1fr))` }} role="group" aria-label={`${area.name} tiles`}>
        {area.tiles.map((t) => (
          <MapTile key={t.id} tile={t} color={area.color} selected={selected === t.id} discovering={pending} onSelect={() => setSelected(t.id)} />
        ))}
      </div>
      {allFound ? (
        <p className="rounded-xl bg-success-soft p-3 text-center text-sm font-semibold text-success">Every tile in {area.name} has been discovered.</p>
      ) : !tile ? (
        <p className="text-center text-sm text-muted-foreground">Tap a tile to explore it</p>
      ) : affordable ? (
        <Button size="xl" className="w-full" onClick={() => run(tile.id)} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {free ? "Use a free discovery" : cost === 0 ? "Discover" : `Discover for ${formatCredits(cost)} Credits`}
        </Button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-gold/40 bg-gold-soft p-3 text-center text-sm">
          <p>
            You need {formatCredits(cost - credits)} more Credits for this tile.
          </p>
          <Button asChild variant="gold" size="lg">
            <Link href="/app/wallet/convert">Get Credits</Link>
          </Button>
        </div>
      )}
      <RewardReveal
        open={Boolean(reveal)}
        onClose={() => {
          setReveal(null);
          router.refresh();
        }}
        title={reveal?.areaCompleted ? `${area.name} fully explored!` : "Tile discovered"}
        rewards={reveal ? [reveal.reward] : []}
        xp={reveal?.xp}
      />
    </div>
  );
}

export function MapCanvas({ areas, freeLeft, freeTotal, credits }: { areas: AreaViewModel[]; freeLeft: number; freeTotal: number; credits: number }) {
  const initial = areas.find((a) => a.accessible && a.discoveredCount < a.tiles.length) ?? areas.find((a) => a.accessible) ?? areas[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const area = areas.find((a) => a.id === selectedId) ?? initial;
  if (!area) return null;
  return (
    <div className="space-y-4">
      <IslandOverview areas={areas} selected={area.id} onSelect={setSelectedId} />
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm">
        <span className="font-medium text-emerald-800">🧭 Free discoveries today</span>
        <span className="font-bold text-emerald-800 tabular">
          {freeLeft}/{freeTotal}
        </span>
      </div>
      <div className="rounded-3xl border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: `color-mix(in oklch, ${area.color}, white 80%)` }} aria-hidden>
            {area.accessible ? area.icon : "🔒"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-heading text-lg font-bold">
              {area.name}
              {area.isSpecial && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase">Special Area</span>}
            </p>
            <p className="text-sm text-muted-foreground">{area.description}</p>
            {area.accessible && (
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {area.discoveredCount}/{area.tiles.length} tiles discovered
              </p>
            )}
          </div>
        </div>
        {area.accessible ? <MapArea key={area.id} area={area} freeLeft={freeLeft} credits={credits} /> : <LockedArea key={area.id} area={area} />}
      </div>
    </div>
  );
}
