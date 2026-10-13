import { Info, PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Token } from "@/components/app/art";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { CancelListingButton, SellSheet } from "@/components/app/market";
import { ItemTile } from "@/components/app/market-item";
import { Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { getConfig } from "@/server/services/config";
import { getMyListings, getSellableItems } from "@/server/services/market";

export const metadata: Metadata = { title: "Sell items" };

export default async function SellPage() {
  const user = await requireUser();
  const [cfg, listings, sellable] = await Promise.all([getConfig("market"), getMyListings(user.id), getSellableItems(user.id)]);

  return (
    <div className="pb-4">
      <InnerPageHeader title="Sell items" subtitle="List items from your collection" back="/market" />

      <Section className="pt-1 pb-0">
        <p className="flex gap-2 rounded-2xl bg-surface p-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Set your price in Credits. LootBox keeps a {cfg.feePct}% fee when an item sells. Cancel any time to get unsold items back.
        </p>
      </Section>

      {listings.length > 0 && (
        <Section
          title="Your listings"
          action={<span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-primary tabular">{listings.length}</span>}
        >
          <ul className="space-y-2">
            {listings.map((l) => {
              const r = rarityOf(l.item.rarity);
              return (
                <li key={l.id} className="flex items-center gap-3 rounded-3xl border bg-card p-3">
                  <Token icon={l.item.icon} rarity={l.item.rarity} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.item.name}</p>
                    <p className="truncate text-xs text-muted-foreground tabular">
                      <span className={cn("font-semibold", r.text)}>{r.label}</span> · {l.quantity} of {l.listedQuantity} left · {formatCredits(l.unitPrice)} each
                    </p>
                  </div>
                  <CancelListingButton listingId={l.id} />
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Your collection">
        {sellable.length === 0 ? (
          <EmptyState
            icon={<PackageOpen className="size-10 text-primary" />}
            title="No items to sell"
            description="Open Mystery Boxes and explore maps to collect items."
            action={
              <Link href="/play" className="text-sm font-bold text-primary">
                Start playing
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {sellable.map((i) => (
              <ItemTile
                key={i.id}
                icon={i.icon}
                rarity={i.rarity}
                name={i.name}
                detail={<>You own {i.quantity}</>}
                action={<SellSheet itemId={i.id} item={i} owned={i.quantity} feePct={cfg.feePct} minPrice={cfg.minPrice} maxPrice={cfg.maxPrice} />}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
