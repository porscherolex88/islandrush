import {
  Anchor,
  Castle,
  Check,
  Coins,
  Compass,
  Crown,
  Diamond,
  Egg,
  Feather,
  Flag,
  Flame,
  Gem,
  Hexagon,
  KeyRound,
  Landmark,
  Leaf,
  Map as MapIcon,
  Mountain,
  Scroll,
  Shell,
  Shield,
  Sparkles,
  Stamp,
  Tent,
  Trees,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { lootEmoji } from "@/lib/adventure";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  shell: Shell,
  pearl: Egg,
  leaf: Leaf,
  idol: Sparkles,
  relic: Landmark,
  scroll: Scroll,
  fragment: Hexagon,
  key: KeyRound,
  crystal: Gem,
  shard: Diamond,
  coin: Coins,
  crown: Crown,
  seal: Stamp,
  compass: Compass,
  feather: Feather,
  banner: Flag,
  scale: Shield,
  ember: Flame,
  map: MapIcon,
  jewel: Gem,
  tent: Tent,
  mountain: Mountain,
  landmark: Landmark,
  castle: Castle,
  flag: Flag,
  anchor: Anchor,
  trees: Trees,
  gem: Gem,
};

export function iconFor(key: string): LucideIcon | null {
  return ICONS[key.toLowerCase()] ?? null;
}

/** Loot and landmark glyph. Known keys map to Lucide icons; anything else (e.g. an emoji set by an admin) renders as text. */
export function LootIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = iconFor(icon);
  if (Icon) return createElement(Icon, { className, "aria-hidden": true });
  return (
    <span className={cn("leading-none", className)} aria-hidden>
      {icon}
    </span>
  );
}

/** A Loot piece in a rarity-coloured medallion. Uncollected pieces show greyed out. */
export function LootToken({ icon, rarity, collected = true, size = "md", className }: { icon: string; rarity?: string | null; collected?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const r = rarityOf(rarity);
  const dims = { sm: "size-9 text-lg", md: "size-12 text-2xl", lg: "size-16 text-[2rem]" }[size];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl ring-2", collected ? cn(r.bg, r.ring) : "bg-muted ring-border", dims, className)} aria-hidden>
      <span className={cn("leading-none", !collected && "opacity-40 grayscale")}>{lootEmoji(icon)}</span>
    </span>
  );
}

export type LootItem = { id: string; name: string; icon: string; rarity: string; description: string; collected: number };

/** The Loot collection for one map level, shown as pieces with counts rather than a bare number. */
export function LootCollection({ items, total, target, doneLabel, className }: { items: LootItem[]; total: number; target: number; doneLabel?: string; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2.5 rounded-2xl border bg-card p-2.5">
            <LootToken icon={it.icon} rarity={it.rarity} collected={it.collected > 0} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{it.name}</p>
              <p className="text-xs text-muted-foreground tabular">× {it.collected}</p>
            </div>
          </div>
        ))}
      </div>
      <LootMeter total={total} target={target} doneLabel={doneLabel} />
    </div>
  );
}

/** Loot progress toward the next threshold, with the pieces drawn as a row of pips when it fits. */
export function LootMeter({
  total,
  target,
  label,
  doneLabel = "Ready",
  className,
  tone = "light",
}: {
  total: number;
  target: number;
  label?: string;
  doneLabel?: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 100;
  const done = total >= target;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={cn("font-semibold", tone === "dark" ? "text-white/85" : "text-muted-foreground")}>{label ?? "Loot collected"}</span>
        {done ? (
          <span className={cn("flex items-center gap-1 font-heading font-extrabold", tone === "dark" ? "text-emerald-300" : "text-success")}>
            <Check className="size-4" strokeWidth={3} aria-hidden /> {doneLabel}
          </span>
        ) : (
          <span className="font-heading font-extrabold tabular">
            {total} / {target}
          </span>
        )}
      </div>
      <div
        className={cn("mt-1.5 h-2.5 overflow-hidden rounded-full", tone === "dark" ? "bg-white/15" : "bg-muted")}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(total, target)}
        aria-label={label ?? "Loot collected"}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-700", done ? "bg-success" : "bg-[linear-gradient(90deg,#fcd34d,#f59e0b)]")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
