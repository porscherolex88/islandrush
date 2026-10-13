"use client";

import { Info } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { PrizeList } from "@/server/services/mystery-box";
import { Token } from "./art";

/** Prize pool, kept one tap away instead of crowding the play screen. */
export function PrizesSheet({ prizes, label = "View prizes", title = "Prize pool", description, className }: { prizes: PrizeList; label?: string; title?: string; description: string; className?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" className={cn("mx-auto flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary hover:bg-brand-soft", className)}>
          <Info className="size-4" aria-hidden />
          {label}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <ul className="space-y-2 px-4 pb-4">
          {prizes.map((o) => {
            const r = rarityOf(o.rarity);
            return (
              <li key={o.id} className="flex items-center gap-3 rounded-2xl border bg-card p-2.5">
                <Token icon={o.icon} rarity={o.rarity} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{o.label}</span>
                  <span className={cn("text-xs font-semibold", r.text)}>{r.label}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="px-4 pb-6 text-xs text-muted-foreground">Results are decided securely on our servers at the moment you play.</p>
      </SheetContent>
    </Sheet>
  );
}
