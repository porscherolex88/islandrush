import { Coins, PackageOpen, Search, Store, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Token } from "@/components/app/art";
import { BuySheet, CancelListingButton, SellSheet } from "@/components/app/market";
import { Section } from "@/components/app/mobile-header";
import { MarketHeader } from "@/components/app/root-page-header";
import { EmptyState } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { getConfig } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";
import { getMarketListings, getMyListings, getSellableItems } from "@/server/services/market";

export const metadata: Metadata = { title: "Market" };

const TABS = [
  { key: "browse", label: "Browse" },
  { key: "sell", label: "Sell" },
  { key: "listings", label: "My listings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Price({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-heading font-extrabold tabular">
      <Coins className="size-4 text-gold" aria-hidden />
      {formatCredits(value)}
    </span>
  );
}

function ItemRow({ icon, rarity, name, detail, right }: { icon: string; rarity: string; name: string; detail: React.ReactNode; right: React.ReactNode }) {
  const r = rarityOf(rarity);
  return (
    <li className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      <Token icon={icon} rarity={rarity} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className={cn("font-semibold", r.text)}>{r.label}</span> · {detail}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </li>
  );
}

export default async function MarketPage({ searchParams }: PageProps<"/app/market">) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "browse";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";

  const [balances, cfg, myListings] = await Promise.all([getBalances(user.id), getConfig("market"), getMyListings(user.id)]);
  const [listings, sellable] = await Promise.all([
    tab === "browse" ? getMarketListings(user.id, { q }) : Promise.resolve([]),
    tab === "sell" ? getSellableItems(user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="pb-4">
      <MarketHeader credits={balances.CREDITS} />

      <Section className="pt-1 pb-0">
        <nav aria-label="Market sections" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "browse" ? "/app/market" : `/app/market?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "flex h-9 items-center justify-center gap-1 rounded-full text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.key === "listings" && myListings.length > 0 && <span className="tabular text-xs text-muted-foreground">({myListings.length})</span>}
            </Link>
          ))}
        </nav>
      </Section>

      {tab === "browse" && (
        <Section className="pt-3 pb-0">
          <form action="/app/market" role="search" className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search items" aria-label="Search items" className="h-11 rounded-full pl-9" />
          </form>
          {listings.length === 0 ? (
            <EmptyState
              className="mt-3"
              icon={<Store className="size-10 text-primary" />}
              title={q ? "No matching items for sale" : "Nothing for sale yet"}
              description={q ? "Try a different search." : "When other players list items, they'll show up here."}
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {listings.map((l) => (
                <ItemRow
                  key={l.id}
                  icon={l.item.icon}
                  rarity={l.item.rarity}
                  name={l.item.name}
                  detail={
                    <>
                      {l.quantity} available · {l.sellerName}
                    </>
                  }
                  right={
                    <>
                      <Price value={l.unitPrice} />
                      <BuySheet listingId={l.id} item={l.item} available={l.quantity} unitPrice={l.unitPrice} seller={l.sellerName} />
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === "sell" && (
        <Section className="pt-3 pb-0">
          <p className="text-sm text-muted-foreground">
            Pick an item from your collection and set a price. LootBox keeps a {cfg.feePct}% fee when it sells.
          </p>
          {sellable.length === 0 ? (
            <EmptyState
              className="mt-3"
              icon={<PackageOpen className="size-10 text-primary" />}
              title="No items to sell"
              description="Open Mystery Boxes and explore maps to collect items."
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {sellable.map((i) => (
                <ItemRow
                  key={i.id}
                  icon={i.icon}
                  rarity={i.rarity}
                  name={i.name}
                  detail={<>You own {i.quantity}</>}
                  right={<SellSheet itemId={i.id} item={i} owned={i.quantity} feePct={cfg.feePct} minPrice={cfg.minPrice} maxPrice={cfg.maxPrice} />}
                />
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === "listings" && (
        <Section className="pt-3 pb-0">
          {myListings.length === 0 ? (
            <EmptyState
              icon={<Tag className="size-10 text-primary" />}
              title="No active listings"
              description="Items you put up for sale appear here until they sell."
              action={
                <Link href="/app/market?tab=sell" className="text-sm font-bold text-primary">
                  Sell an item
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {myListings.map((l) => (
                <ItemRow
                  key={l.id}
                  icon={l.item.icon}
                  rarity={l.item.rarity}
                  name={l.item.name}
                  detail={
                    <>
                      {l.quantity} of {l.listedQuantity} left · {formatCredits(l.unitPrice)} each
                    </>
                  }
                  right={<CancelListingButton listingId={l.id} />}
                />
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}
