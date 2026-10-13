import { ArrowLeftRight, Coins, Library, Tag } from "lucide-react";
import { RARITY, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { SectionHeading } from "../marketing";

const LISTINGS: { name: string; rarity: RarityKey; price: string }[] = [
  { name: "Tide Pearl", rarity: "UNCOMMON", price: "120" },
  { name: "Jade Idol", rarity: "RARE", price: "480" },
  { name: "Glow Shard", rarity: "EPIC", price: "1,250" },
  { name: "Crown Jewel", rarity: "LEGENDARY", price: "6,000" },
];

const POINTS = [
  { icon: Library, title: "Collect", body: "See everything you own on your Collections page, sellable items and keepsakes side by side." },
  { icon: Tag, title: "Sell", body: "List spare items on the Market at your own price in Credits." },
  { icon: ArrowLeftRight, title: "Buy", body: "Pick up items from other players with your Credits." },
];

export function MarketShowcase() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div className="relative order-2 lg:order-1">
        <div className="rounded-[1.75rem] border bg-card p-3 shadow-[0_30px_60px_-30px_rgb(10_11_13/0.25)]">
          <div className="flex items-center justify-between px-2 pt-1 pb-3">
            <p className="font-heading text-lg font-extrabold">Market</p>
            <p className="text-xs text-muted-foreground">Example listings</p>
          </div>
          <ul className="space-y-2">
            {LISTINGS.map((l) => {
              const r = RARITY[l.rarity];
              return (
                <li key={l.name} className="flex items-center gap-3 rounded-2xl border bg-background p-3 transition-transform duration-200 hover:-translate-y-0.5">
                  <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-2", r.bg, r.ring)}>
                    <span className="size-4 rotate-45 rounded-[3px]" style={{ backgroundColor: r.hex }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.name}</span>
                    <span className={cn("text-xs font-semibold", r.text)}>{r.label}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-heading font-extrabold tabular">
                    <Coins className="size-4 text-gold" aria-hidden />
                    {l.price}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <SectionHeading
          eyebrow="Collect and trade"
          title="Every item has a home, or a buyer"
          description="Five rarities, from Common to Legendary. Keep what moves your adventure forward and trade the rest with other explorers."
          className="mb-0 sm:mb-0"
        />
        <ul className="mt-8 space-y-5">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-bold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
