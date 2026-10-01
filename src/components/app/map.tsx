"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Compass, KeyRound, Loader2, Lock, MapPin, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { useFormatCash } from "@/components/providers/fiat-currency-provider";
import { formatCredits } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { discoverTileAction, unlockAreaAction } from "@/server/actions/games";
import type { RewardResult } from "@/server/services/rewards";
import { ART, regionArt } from "./art";
import { RequirementList, type RequirementView } from "./requirement-list";
import { RewardReveal } from "./reward-reveal";

export type TileView = { id: string; row: number; col: number; name: string; icon: string; discovered: boolean; reward: RewardResult | null; cost: number };
export type AreaViewModel = {
  id: string;
  slug: string;
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
export type VaultMarker = { name: string; unlocked: boolean; ready: boolean; keys: string | null };

/** Pin positions (percent of the island artwork) for the regions painted on it. */
const REGION_PINS: Record<string, { x: number; y: number }> = {
  beach: { x: 42, y: 80 },
  jungle: { x: 27, y: 57 },
  ruins: { x: 63, y: 40 },
  temple: { x: 58, y: 13 },
};
const FALLBACK_PINS = [
  { x: 42, y: 80 },
  { x: 27, y: 57 },
  { x: 63, y: 40 },
  { x: 58, y: 13 },
  { x: 76, y: 66 },
  { x: 20, y: 36 },
];

function pinFor(area: AreaViewModel, i: number) {
  const key = Object.keys(REGION_PINS).find((k) => area.slug.includes(k) || area.name.toLowerCase().includes(k));
  return key ? REGION_PINS[key] : FALLBACK_PINS[i % FALLBACK_PINS.length];
}

/** The painted island with one pin per region, the route between them and a "you are here" marker. */
function IslandOverview({ areas, selected, current, vault, onSelect }: { areas: AreaViewModel[]; selected: string; current: string; vault: VaultMarker | null; onSelect: (id: string) => void }) {
  const reduce = useReducedMotion();
  const pins = areas.map((a, i) => ({ area: a, ...pinFor(a, i) }));
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-[2rem] bg-ocean">
      <Image src={ART.island} alt="Illustrated map of the island" fill priority sizes="(max-width: 430px) 100vw, 430px" className="object-cover" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        {pins.slice(1).map((p, i) => {
          const prev = pins[i];
          const reached = p.area.accessible;
          return <line key={p.area.id} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={reached ? "#fde68a" : "#ffffff"} strokeOpacity={reached ? 0.95 : 0.55} strokeWidth={3} strokeDasharray="6 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {pins.map(({ area: a, x, y }) => {
        const complete = a.accessible && a.tiles.length > 0 && a.discoveredCount === a.tiles.length;
        const isCurrent = a.id === current;
        return (
          <motion.button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-pressed={selected === a.id}
            aria-label={`${a.name}${a.accessible ? `, ${a.discoveredCount} of ${a.tiles.length} discovered` : ", locked"}${isCurrent ? ", you are here" : ""}`}
            animate={reduce || selected !== a.id ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            {isCurrent && (
              <span className="absolute -top-9 left-1/2 flex -translate-x-1/2 flex-col items-center" aria-hidden>
                <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap text-amber-950">You are here</span>
                <MapPin className="size-5 fill-amber-300 text-amber-900" />
              </span>
            )}
            <span
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full border-2 py-1 pr-3 pl-1 text-xs font-bold whitespace-nowrap backdrop-blur",
                selected === a.id ? "border-amber-300 bg-white text-foreground" : "border-white/80 bg-white/90 text-foreground",
                !a.accessible && "border-white/40 bg-slate-900/70 text-white",
              )}
            >
              <span className={cn("grid size-8 place-items-center rounded-full", complete ? "bg-success text-white" : a.accessible ? "bg-primary text-white" : "bg-white/15 text-white")}>
                {complete ? <Check className="size-4" aria-hidden /> : a.accessible ? <span className="text-sm tabular">{a.discoveredCount}</span> : <Lock className="size-4" aria-hidden />}
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="flex items-center gap-1">
                  {a.name}
                  {a.isSpecial && <Sparkles className="size-3 text-amber-500" aria-hidden />}
                </span>
                <span className={cn("text-[10px] font-semibold", a.accessible ? "text-muted-foreground" : "text-white/70")}>{a.accessible ? `${a.discoveredCount}/${a.tiles.length} found` : "Locked"}</span>
              </span>
            </span>
          </motion.button>
        );
      })}
      {vault && (
        <Link
          href="/app/play/vault"
          className="absolute top-[24%] right-[4%] z-10 flex min-h-11 items-center gap-1.5 rounded-full border-2 border-amber-300/80 bg-slate-900/75 py-1 pr-3 pl-1 text-xs font-bold text-white backdrop-blur"
          aria-label={`${vault.name}${vault.unlocked ? ", opened" : vault.ready ? ", ready to open" : ", locked"}`}
        >
          <span className="grid size-8 place-items-center rounded-full bg-amber-400 text-amber-950">
            <KeyRound className="size-4" aria-hidden />
          </span>
          <span className="flex flex-col leading-tight">
            Vault
            <span className="text-[10px] font-semibold text-white/75">{vault.unlocked ? "Opened" : vault.ready ? "Ready!" : (vault.keys ?? "Locked")}</span>
          </span>
        </Link>
      )}
    </div>
  );
}

/** A single stop on the region trail. */
export function MapTile({ tile, selected, next, discovering, onSelect }: { tile: TileView; selected: boolean; next: boolean; discovering: boolean; onSelect: () => void }) {
  const reduce = useReducedMotion();
  if (tile.discovered && tile.reward) {
    const r = rarityOf(tile.reward.rarity);
    return (
      <motion.div
        className={cn("relative grid size-14 shrink-0 place-items-center rounded-full text-2xl ring-[3px]", r.bg, r.ring)}
        initial={reduce ? false : { scale: 0.5, rotate: -20, opacity: 0 }}
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
      aria-label={`${tile.name}, not discovered yet`}
      className={cn(
        "relative grid size-14 shrink-0 place-items-center rounded-full border-2 border-dashed border-amber-700/40 bg-[radial-gradient(circle_at_35%_30%,#fef3c7,#fcd34d_70%,#d97706)] text-xl font-black text-amber-900/70 outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        selected && "border-solid border-white outline-3 outline-offset-1 outline-amber-400",
      )}
      animate={reduce ? undefined : discovering && selected ? { scale: [1, 1.12, 1], rotate: [0, 6, -6, 0] } : selected ? { y: -4, scale: 1.08 } : next ? { scale: [1, 1.06, 1] } : { scale: 1, y: 0 }}
      transition={discovering && selected ? { duration: 0.6, repeat: Infinity } : next && !selected ? { duration: 1.8, repeat: Infinity } : { type: "spring", stiffness: 400, damping: 20 }}
    >
      <span aria-hidden>?</span>
    </motion.button>
  );
}

/** Tiles laid out as a winding trail: rows alternate direction and are joined by dashed paths. */
function Trail({ area, selected, discovering, onSelect }: { area: AreaViewModel; selected: string | null; discovering: boolean; onSelect: (id: string) => void }) {
  const cols = Math.max(1, area.gridCols);
  const rows: TileView[][] = [];
  area.tiles.forEach((t, i) => {
    const r = Math.floor(i / cols);
    (rows[r] ??= []).push(t);
  });
  const nextId = area.accessible ? area.tiles.find((t) => !t.discovered)?.id : undefined;
  return (
    <div className="space-y-0" role="group" aria-label={`${area.name} trail`}>
      {rows.map((row, r) => {
        return (
          <Fragment key={r}>
            {r > 0 && (
              <div className={cn("flex h-6", r % 2 === 1 ? "justify-end pr-[26px]" : "justify-start pl-[26px]")} aria-hidden>
                <span className={cn("w-1 border-l-[3px] border-dashed", rows[r - 1].every((t) => t.discovered) ? "border-amber-500" : "border-amber-700/25")} />
              </div>
            )}
            <div className={cn("flex items-center", r % 2 === 1 && "flex-row-reverse")}>
              {row.map((t, i) => (
                <Fragment key={t.id}>
                  {i > 0 && <span aria-hidden className={cn("h-1 min-w-2 flex-1 border-t-[3px] border-dashed", row[i - 1].discovered ? "border-amber-500" : "border-amber-700/25")} />}
                  <MapTile tile={t} selected={selected === t.id} next={t.id === nextId && !selected} discovering={discovering} onSelect={() => onSelect(t.id)} />
                </Fragment>
              ))}
              {row.length < cols && <span className="flex-1" />}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export function LockedArea({ area }: { area: AreaViewModel }) {
  const router = useRouter();
  const [reveal, setReveal] = useState<{ rewards: RewardResult[]; xp: number; title: string } | null>(null);
  const { run, pending } = useAction(unlockAreaAction, {
    refresh: false,
    onSuccess: (d) => setReveal({ rewards: d.rewards, xp: d.xp, title: `${d.areaName} unlocked` }),
  });
  const consumed = area.requirements.filter((r) => r.consume);
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">
        You need{" "}
        {area.requirements.map((r, i) => (
          <Fragment key={r.id}>
            {i > 0 && " + "}
            <strong>
              {r.required > 1 ? `${r.required} ` : ""}
              {r.label.replace(/^Discover \d+ /, "")}
            </strong>
          </Fragment>
        ))}{" "}
        to unlock the {area.name}.
      </p>
      <RequirementList requirements={area.requirements} />
      {consumed.length > 0 && <p className="text-xs text-muted-foreground">{consumed.map((c) => c.label).join(" and ")} will be used up when you unlock.</p>}
      <Button size="pill" className="w-full" variant={area.canUnlock ? "gold" : "secondary"} disabled={!area.canUnlock || pending} onClick={() => run(area.id)}>
        {pending ? <Loader2 className="animate-spin" /> : area.canUnlock ? <Sparkles /> : <Lock />}
        {area.canUnlock ? `Unlock the ${area.name}` : `${area.name} locked`}
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
        collectLabel="Start exploring"
      />
    </div>
  );
}

export function MapArea({ area, freeLeft, credits, rate }: { area: AreaViewModel; freeLeft: number; credits: number; rate: { cash: number; credits: number } }) {
  const fmt = useFormatCash();
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
  const rm = (cost * rate.cash) / Math.max(1, rate.credits);

  return (
    <div className="space-y-4">
      <Trail area={area} selected={selected} discovering={pending} onSelect={setSelected} />
      {allFound ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl bg-success-soft p-3 text-center text-sm font-semibold text-success">
          <Check className="size-4" aria-hidden /> Every spot in the {area.name} has been discovered.
        </p>
      ) : !tile ? (
        <p className="text-center text-sm text-muted-foreground">Tap a glowing spot to explore it</p>
      ) : affordable ? (
        <Button size="pill" variant="gold" className="w-full" onClick={() => run(tile.id)} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Compass />}
          {free ? "Use a free discovery" : cost === 0 ? "Discover" : `Discover for ${formatCredits(cost)} Credits`}
        </Button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-gold/40 bg-gold-soft p-3 text-center text-sm">
          <p>You need {formatCredits(cost - credits)} more Credits to explore this spot.</p>
          <Button asChild variant="gold" size="pill">
            <Link href="/app/wallet/convert">Get Credits</Link>
          </Button>
        </div>
      )}
      {tile && !free && cost > 0 && (
        <p className="-mt-2 text-center text-xs text-muted-foreground tabular">
          ≈ {fmt(rm.toFixed(2))} per spot
        </p>
      )}
      <RewardReveal
        open={Boolean(reveal)}
        onClose={() => {
          setReveal(null);
          router.refresh();
        }}
        title={reveal?.areaCompleted ? `${area.name} fully explored!` : "You found"}
        rewards={reveal ? [reveal.reward] : []}
        xp={reveal?.xp}
      />
    </div>
  );
}

export function MapCanvas({
  areas,
  freeLeft,
  freeTotal,
  credits,
  rate,
  vault,
}: {
  areas: AreaViewModel[];
  freeLeft: number;
  freeTotal: number;
  credits: number;
  rate: { cash: number; credits: number };
  vault: VaultMarker | null;
}) {
  const current = areas.find((a) => a.accessible && a.discoveredCount < a.tiles.length) ?? areas.filter((a) => a.accessible).at(-1) ?? areas[0];
  const [selectedId, setSelectedId] = useState(current?.id ?? "");
  const area = areas.find((a) => a.id === selectedId) ?? current;
  if (!area || !current) return null;
  return (
    <div className="space-y-4">
      <IslandOverview areas={areas} selected={area.id} current={current.id} vault={vault} onSelect={setSelectedId} />
      <div className="flex min-h-12 items-center justify-between rounded-2xl bg-success-soft px-4 text-sm">
        <span className="flex items-center gap-2 font-semibold text-success">
          <Compass className="size-4" aria-hidden /> Free discoveries today
        </span>
        <span className="font-heading text-lg font-extrabold text-success tabular">
          {freeLeft} / {freeTotal}
        </span>
      </div>
      <div className="overflow-hidden rounded-[2rem] border bg-card">
        <div className="relative isolate h-36 text-white">
          <Image src={regionArt(area.slug || area.name)} alt="" fill sizes="(max-width: 430px) 100vw, 430px" className={cn("-z-10 object-cover", !area.accessible && "grayscale-[60%]")} />
          <div aria-hidden className="art-scrim absolute inset-0 -z-10" />
          <div className="flex h-full flex-col justify-end p-4">
            <p className="flex items-center gap-2 font-heading text-2xl font-extrabold">
              {!area.accessible && <Lock className="size-5" aria-hidden />}
              {area.name}
              {area.isSpecial && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-950">Special Area</span>}
            </p>
            <p className="max-w-[75%] text-sm text-white/85">{area.description}</p>
            {area.accessible && (
              <p className="mt-1 text-xs font-bold text-amber-200 tabular">
                {area.discoveredCount} / {area.tiles.length} discovered
              </p>
            )}
          </div>
        </div>
        <div className="p-4">{area.accessible ? <MapArea key={area.id} area={area} freeLeft={freeLeft} credits={credits} rate={rate} /> : <LockedArea key={area.id} area={area} />}</div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Regions">
        {areas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={a.id === area.id}
            onClick={() => setSelectedId(a.id)}
            className={cn("flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", a.id === area.id ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
          >
            {!a.accessible && <Lock className="size-3.5" aria-hidden />}
            {a.name}
          </button>
        ))}
      </div>
    </div>
  );
}
