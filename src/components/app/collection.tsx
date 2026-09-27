import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { ItemView } from "@/server/queries/collections";

export function CollectionProgress({ owned, total }: { owned: number; total: number }) {
  const complete = total > 0 && owned >= total;
  return (
    <div className="flex items-center gap-2">
      <Progress value={(owned / Math.max(1, total)) * 100} className="h-2" indicatorClassName={complete ? "bg-success" : undefined} aria-label="Collection progress" />
      <span className="text-xs font-bold whitespace-nowrap text-muted-foreground tabular">
        {owned}/{total}
      </span>
    </div>
  );
}

export function CollectionCard({
  slug,
  name,
  description,
  icon,
  owned,
  total,
  completed,
  preview,
}: {
  slug: string;
  name: string;
  description: string;
  icon: string;
  owned: number;
  total: number;
  completed: boolean;
  preview: { id: string; icon: string; owned: boolean }[];
}) {
  return (
    <Link href={`/app/collections/${slug}`} className="block rounded-2xl border bg-card p-4 shadow-card transition-colors hover:bg-surface">
      <div className="flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface text-3xl" aria-hidden>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-heading text-lg font-bold">
            {name}
            {completed && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success uppercase">
                <Check className="size-3" /> Complete
              </span>
            )}
          </p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {preview.map((p) => (
          <span key={p.id} className={cn("grid size-9 place-items-center rounded-lg bg-surface text-lg", !p.owned && "opacity-30 grayscale")}>
            {p.icon}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <CollectionProgress owned={owned} total={total} />
      </div>
    </Link>
  );
}

export function InventoryItem({ item, showPurpose = true }: { item: ItemView; showPurpose?: boolean }) {
  const r = rarityOf(item.rarity);
  const owned = item.totalAcquired > 0;
  return (
    <div className={cn("flex gap-3 rounded-2xl border bg-card p-3", !owned && "bg-surface/60")}>
      <div className={cn("relative grid size-14 shrink-0 place-items-center rounded-xl text-3xl ring-2", owned ? `${r.bg} ${r.ring}` : "bg-muted ring-transparent grayscale")}>
        <span aria-hidden className={cn(!owned && "opacity-30")}>
          {item.icon}
        </span>
        {item.quantity > 1 && (
          <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-foreground px-1.5 text-[10px] leading-4 font-bold text-background">×{item.quantity}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-sm font-semibold", !owned && "text-muted-foreground")}>{owned ? item.name : `${item.name}`}</p>
          <span className={cn("text-[10px] font-bold tracking-wide uppercase", r.text)}>{r.label}</span>
        </div>
        {showPurpose && <p className="text-xs text-muted-foreground">{item.purpose}</p>}
        {item.kind === "FRAGMENT" && item.fragmentsRequired && item.assemblesInto && (
          <div className="mt-1.5">
            <Progress value={(Math.min(item.quantity, item.fragmentsRequired) / item.fragmentsRequired) * 100} className="h-1.5" indicatorClassName="bg-amber-500" aria-label="Fragments collected" />
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {Math.min(item.quantity, item.fragmentsRequired)}/{item.fragmentsRequired} to assemble {item.assemblesInto.icon} {item.assemblesInto.name}
            </p>
          </div>
        )}
        {!owned && <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Not found yet</p>}
      </div>
    </div>
  );
}
