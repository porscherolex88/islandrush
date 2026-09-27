import { Check, ChevronRight, KeyRound } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { CollectionUnlock, ItemView } from "@/server/queries/collections";
import { Token } from "./art";

export function CollectionProgress({ owned, total }: { owned: number; total: number }) {
  const complete = total > 0 && owned >= total;
  const pct = Math.round((owned / Math.max(1, total)) * 100);
  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className="h-2.5" indicatorClassName={complete ? "bg-success" : "bg-amber-500"} aria-label="Collection progress" />
      <span className="text-xs font-bold whitespace-nowrap tabular">{pct}%</span>
    </div>
  );
}

/** Plain sentence explaining what a collection unlocks, e.g. "8 of these 10 relics unlock the Temple." */
export function UnlockNote({ unlocks, total, noun = "items" }: { unlocks: CollectionUnlock[]; total: number; noun?: string }) {
  if (!unlocks.length) return null;
  return (
    <ul className="space-y-1">
      {unlocks.map((u, i) => (
        <li key={i} className="flex items-start gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold-foreground">
          <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {u.complete ? (
              <>
                Complete all {total} {noun} to unlock <strong>the {u.target}</strong>.
              </>
            ) : (
              <>
                <strong>
                  {u.required} of these {total} {noun}
                </strong>{" "}
                are required to unlock <strong>the {u.target}</strong>.
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function collectionNoun(name: string) {
  const last = name.trim().split(" ").at(-1)?.toLowerCase() ?? "items";
  return last.endsWith("s") ? last : "items";
}

export function CollectionCard({
  slug,
  name,
  description,
  icon,
  owned,
  total,
  completed,
  items,
  unlocks,
}: {
  slug: string;
  name: string;
  description: string;
  icon: string;
  owned: number;
  total: number;
  completed: boolean;
  items: ItemView[];
  unlocks: CollectionUnlock[];
}) {
  return (
    <Link href={`/app/collections/${slug}`} className="block overflow-hidden rounded-3xl border bg-card shadow-card transition-colors hover:bg-surface">
      <div className="flex items-center gap-3 bg-[linear-gradient(135deg,oklch(0.95_0.04_85),oklch(0.98_0.02_85))] p-4">
        <Token icon={icon} rarity="LEGENDARY" size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg leading-tight font-extrabold uppercase">{name}</p>
          <p className="font-heading text-2xl font-extrabold tabular">
            {owned} <span className="text-base text-muted-foreground">/ {total}</span>
          </p>
        </div>
        {completed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-bold text-white">
            <Check className="size-3.5" /> Complete
          </span>
        ) : (
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="grid grid-cols-5 gap-2" aria-label={`${owned} of ${total} found`}>
          {items.map((i) => (
            <Token key={i.id} icon={i.icon} rarity={i.rarity} owned={i.totalAcquired > 0} size="md" className="aspect-square h-auto w-full" />
          ))}
        </div>
        <CollectionProgress owned={owned} total={total} />
        <UnlockNote unlocks={unlocks} total={total} noun={collectionNoun(name)} />
      </div>
    </Link>
  );
}

/** One page of the collection book: artwork or silhouette, rarity and where to find it. */
export function BookItem({ item }: { item: ItemView }) {
  const r = rarityOf(item.rarity);
  const owned = item.totalAcquired > 0;
  return (
    <div className={cn("flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center", owned ? "bg-card shadow-card" : "border-dashed bg-surface/70")}>
      <Token icon={item.icon} rarity={item.rarity} owned={owned} size="lg" quantity={item.quantity} />
      <p className={cn("line-clamp-2 text-sm leading-tight font-bold", !owned && "text-muted-foreground")}>{item.name}</p>
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase", r.bg, r.text)}>{r.label}</span>
      <p className="text-[11px] leading-snug text-muted-foreground">{owned ? "Found" : item.sources.length ? `Find it: ${item.sources.slice(0, 2).join(", ")}` : "Keep exploring"}</p>
    </div>
  );
}

export function InventoryItem({ item, showPurpose = true }: { item: ItemView; showPurpose?: boolean }) {
  const r = rarityOf(item.rarity);
  const owned = item.totalAcquired > 0 || item.quantity > 0;
  return (
    <div className={cn("flex gap-3 rounded-2xl border bg-card p-3", !owned && "border-dashed bg-surface/60")}>
      <Token icon={item.icon} rarity={item.rarity} owned={owned} size="md" quantity={item.quantity} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-sm font-bold", !owned && "text-muted-foreground")}>{item.name}</p>
          <span className={cn("text-[10px] font-bold tracking-wide uppercase", r.text)}>{r.label}</span>
        </div>
        {showPurpose && <p className="text-xs text-muted-foreground">{item.purpose}</p>}
        {item.kind === "FRAGMENT" && item.fragmentsRequired && item.assemblesInto && (
          <div className="mt-1.5">
            <Progress value={(Math.min(item.quantity, item.fragmentsRequired) / item.fragmentsRequired) * 100} className="h-1.5" indicatorClassName="bg-amber-500" aria-label="Fragments collected" />
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {Math.min(item.quantity, item.fragmentsRequired)}/{item.fragmentsRequired} to make the {item.assemblesInto.name}
            </p>
          </div>
        )}
        {!owned && item.sources.length > 0 && <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Find it: {item.sources.slice(0, 2).join(", ")}</p>}
      </div>
    </div>
  );
}
