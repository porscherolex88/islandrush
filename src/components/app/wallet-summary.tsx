import { Coins, Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { credits: Coins, withdrawable: Landmark, cash: Wallet } as const;
const TONES = { credits: "text-gold", withdrawable: "text-success", cash: "text-primary" } as const;

/** One-line balance strip shown at the top of every wallet subpage, highlighting the balance the page acts on. */
export function WalletSummary({
  items,
  highlight,
  className,
}: {
  items: { key: keyof typeof ICONS; label: string; value: string }[];
  highlight?: keyof typeof ICONS;
  className?: string;
}) {
  return (
    <dl className={cn("grid divide-x overflow-hidden rounded-3xl border bg-card", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(({ key, label, value }) => {
        const Icon = ICONS[key];
        return (
          <div key={key} className={cn("min-w-0 px-3.5 py-3", highlight === key && "bg-brand-soft/60")}>
            <dt className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Icon className={cn("size-3.5", TONES[key])} aria-hidden /> {label}
            </dt>
            <dd className="truncate font-heading text-lg font-extrabold tabular">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
