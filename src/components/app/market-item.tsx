import { Coins } from "lucide-react";
import type { ReactNode } from "react";
import { rarityOf } from "@/lib/rarity";
import { formatCredits } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-heading font-extrabold tabular">
      <Coins className="size-4 text-gold" aria-hidden />
      {formatCredits(value)}
    </span>
  );
}

/** Market grid tile: the item centred in a rarity-tinted square, details and action below. */
export function ItemTile({ icon, rarity, name, detail, price, action }: { icon: string; rarity: string; name: string; detail: ReactNode; price?: ReactNode; action: ReactNode }) {
  const r = rarityOf(rarity);
  return (
    <li className="flex min-w-0 flex-col items-center gap-2 pb-3 text-center">
      <div className={cn("grid aspect-square w-full place-items-center rounded-3xl text-6xl", r.bg)} aria-hidden>
        {icon}
      </div>
      <div className="w-full min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className={cn("text-xs font-semibold", r.text)}>{r.label}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="mt-auto flex w-full flex-col items-center gap-2">
        {price}
        <div className="w-full [&>button]:w-full">{action}</div>
      </div>
    </li>
  );
}
