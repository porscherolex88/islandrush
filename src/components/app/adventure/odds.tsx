"use client";

import { Banknote, Coins, Gift, Info, LockOpen } from "lucide-react";
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
  return (o: Pick<Odd, "type" | "amount" | "label">) =>
    o.type === "CREDITS" ? `${formatCredits(o.amount)} Credits` : o.type === "CASH" ? `${fmt(o.amount)} Cash Reward` : o.type === "FREE_UNLOCK" ? "Free unlock" : o.label;
}

const GLYPH: Record<string, { icon: typeof Coins; tone: string }> = {
  CREDITS: { icon: Coins, tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  CASH: { icon: Banknote, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  FREE_UNLOCK: { icon: LockOpen, tone: "bg-violet-50 text-violet-700 ring-violet-200" },
};

export function RewardGlyph({ type, icon, rarity, size = "sm" }: { type: string; icon: string; rarity?: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "size-9 [&_svg]:size-4.5", md: "size-12 [&_svg]:size-6", lg: "size-16 [&_svg]:size-8" }[size];
  if (type === "ITEM") return <LootToken icon={icon} rarity={rarity} size={size} />;
  const { icon: Icon, tone } = GLYPH[type] ?? { icon: Gift, tone: "bg-amber-50 text-amber-700 ring-amber-200" };
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl ring-2", tone, dims)} aria-hidden>
      <Icon />
    </span>
  );
}

function chance(pct: number) {
  return `${pct.toFixed(pct < 1 ? 2 : pct < 10 ? 1 : 0)}%`;
}

/**
 * Everything a box can give, grouped the way players think about it: Loot on every open, plus one
 * lucky drop that is Credits, Cash or a Free unlock. Chances add up across a group's entries.
 */
export function BoxContents({ rewards, loot, tone = "light", className }: { rewards: PoolOdds; loot: PoolOdds; tone?: "light" | "dark"; className?: string }) {
  const fmt = useFormatCash();
  const group = (type: string) => {
    const rows = rewards.filter((o) => o.type === type);
    if (!rows.length) return null;
    const amounts = rows.map((o) => Number(o.amount));
    return { pct: rows.reduce((s, o) => s + o.pct, 0), min: Math.min(...amounts), max: Math.max(...amounts) };
  };
  const credits = group("CREDITS");
  const cash = group("CASH");
  const unlock = group("FREE_UNLOCK");
  const lootQty = loot.map((o) => Math.max(1, Math.floor(Number(o.amount) || 1)));
  const dark = tone === "dark";

  const tiles: { key: string; type: string; icon: string; title: string; value: string; odds: string }[] = [];
  if (loot.length) {
    const lo = Math.min(...lootQty);
    const hi = Math.max(...lootQty);
    tiles.push({ key: "loot", type: "ITEM", icon: loot[0].icon, title: "Loot", value: lo === hi ? `${lo} pieces` : `${lo}-${hi} pieces`, odds: "Every box" });
  }
  if (credits) tiles.push({ key: "credits", type: "CREDITS", icon: "", title: "Free Credits", value: `${formatCredits(credits.min)}-${formatCredits(credits.max)}`, odds: `${chance(credits.pct)} chance` });
  if (cash) tiles.push({ key: "cash", type: "CASH", icon: "", title: "Free Cash", value: `${fmt(String(cash.min))}-${fmt(String(cash.max))}`, odds: `${chance(cash.pct)} chance` });
  if (unlock) tiles.push({ key: "unlock", type: "FREE_UNLOCK", icon: "", title: "Free unlock", value: "Fills your next chest", odds: `${chance(unlock.pct)} chance` });

  return (
    <ul className={cn("grid grid-cols-2 gap-2", className)}>
      {tiles.map((t) => (
        <li key={t.key} className={cn("flex min-h-16 items-center gap-2.5 rounded-2xl p-2.5", dark ? "bg-white/10 ring-1 ring-white/10" : "border bg-card")}>
          <RewardGlyph type={t.type} icon={t.icon} rarity={t.type === "ITEM" ? loot[0]?.rarity : null} size="sm" />
          <span className="min-w-0">
            <span className="block text-sm leading-tight font-bold">{t.title}</span>
            <span className={cn("block truncate text-xs tabular", dark ? "text-white/75" : "text-muted-foreground")}>{t.value}</span>
            <span className={cn("block text-[11px] font-semibold tabular", dark ? "text-amber-200" : "text-primary")}>{t.odds}</span>
          </span>
        </li>
      ))}
    </ul>
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
              <span className={cn("text-xs font-semibold", r.text)}>{o.type === "FREE_UNLOCK" ? "Fills your next chest for free" : r.label}</span>
            </span>
            <span className="text-sm font-bold tabular">{o.pct.toFixed(o.pct < 1 ? 2 : 1)}%</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "View prizes & odds" for an adventure box: the guaranteed Loot drop and the lucky drop table. */
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
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{name}: prizes & odds</SheetTitle>
          <SheetDescription>Every box contains one Loot drop and one lucky drop. Both are drawn separately on our servers when you open it.</SheetDescription>
        </SheetHeader>
        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-4 pb-4">
          {loot.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold">Loot drop (guaranteed)</h3>
              <OddsList odds={loot} />
            </section>
          )}
          <section>
            <h3 className="mb-2 text-sm font-bold">Lucky drop: Credits, Cash or a Free unlock</h3>
            <OddsList odds={rewards} />
          </section>
          <p className="text-xs text-muted-foreground">
            Percentages are the chance on every single open. Past results never change the odds. A Free unlock adds exactly the Loot you need to open your next map or checkpoint; if there&apos;s nothing left to unlock, it pays out in Credits instead. Loot stays in your collection: unlocking maps and checkpoints never uses it up.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
