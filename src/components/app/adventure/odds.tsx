"use client";

import { Banknote, Coins, Gift, Info, Star } from "lucide-react";
import type { ReactNode } from "react";
import { useFormatCash } from "@/components/providers/fiat-currency-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatCredits } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { PoolOdds } from "@/server/services/mystery-box";
import { LootToken } from "./loot";

type Odd = PoolOdds[number];

/** Human label for a pool entry: Credits and Cash amounts are formatted for the viewer, items keep their label. */
export function useOddLabel() {
  const fmt = useFormatCash();
  return (o: Pick<Odd, "type" | "amount" | "label">) => (o.type === "CREDITS" ? `${formatCredits(o.amount)} Credits` : o.type === "CASH" ? `${fmt(o.amount)} Cash Reward` : o.label);
}

export function RewardGlyph({ type, icon, rarity, size = "sm" }: { type: string; icon: string; rarity?: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "size-9 [&_svg]:size-4.5", md: "size-12 [&_svg]:size-6", lg: "size-16 [&_svg]:size-8" }[size];
  if (type === "ITEM") return <LootToken icon={icon} rarity={rarity} size={size} />;
  const Icon = type === "CREDITS" ? Coins : type === "CASH" ? Banknote : type === "XP" ? Star : Gift;
  const tone = type === "CASH" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200";
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl ring-2", tone, dims)} aria-hidden>
      <Icon />
    </span>
  );
}

function OddsList({ odds }: { odds: PoolOdds }) {
  const label = useOddLabel();
  return (
    <ul className="space-y-2">
      {odds.map((o) => {
        const r = rarityOf(o.rarity);
        return (
          <li key={o.id} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card p-2.5">
            <RewardGlyph type={o.type} icon={o.icon} rarity={o.rarity} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{label(o)}</span>
              <span className={cn("text-xs font-semibold", r.text)}>{r.label}</span>
            </span>
            <span className="text-sm font-bold tabular">{o.pct.toFixed(o.pct < 1 ? 2 : 1)}%</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "View prizes & odds" for an adventure box: the guaranteed Loot drop and the bonus reward table. */
export function BoxOddsSheet({ name, rewards, loot, trigger }: { name: string; rewards: PoolOdds; loot: PoolOdds; trigger?: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <button type="button" className="mx-auto flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary hover:bg-brand-soft">
            <Info className="size-4" aria-hidden />
            View prizes & odds
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-[430px] overflow-y-auto rounded-t-3xl pb-safe">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{name}: prizes & odds</SheetTitle>
          <SheetDescription>Every box contains one Loot drop and one bonus reward. Both are drawn separately on our servers when you open it.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-4">
          {loot.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold">Loot drop (guaranteed)</h3>
              <OddsList odds={loot} />
            </section>
          )}
          <section>
            <h3 className="mb-2 text-sm font-bold">Bonus reward</h3>
            <OddsList odds={rewards} />
          </section>
          <p className="text-xs text-muted-foreground">Percentages are the chance on every single open. Past results never change the odds. Loot stays in your collection: unlocking maps and checkpoints never uses it up.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
