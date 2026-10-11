import { Clock, Coins, PackageOpen, Search, Store, Tag, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Token } from "@/components/app/art";
import { SegmentedNav, StatTile } from "@/components/app/kit";
import { BuySheet, CancelListingButton, SellSheet } from "@/components/app/market";
import { Section } from "@/components/app/mobile-header";
import { MarketHeader } from "@/components/app/root-page-header";
import { EmptyState } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { maskName } from "@/lib/mask-name";
import { formatCredits } from "@/lib/money";
import { RARITY, rarityOf, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { getConfig } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";
import { getMarketListings, getMarketStats, getMyListings, getSellableItems } from "@/server/services/market";

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
    <li className="flex items-center gap-3 rounded-3xl border bg-card p-3">
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

export default async function MarketPage({ searchParams }: PageProps<"/market">) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "browse";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const rarity = typeof sp.rarity === "string" && sp.rarity in RARITY ? (sp.rarity as RarityKey) : undefined;
  const browseHref = (r?: RarityKey) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (r) params.set("rarity", r);
    const qs = params.toString();
    return qs ? `/market?${qs}` : "/market";
  };

  const [balances, cfg, myListings, stats] = await Promise.all([getBalances(user.id), getConfig("market"), getMyListings(user.id), getMarketStats(user.id)]);
  const [listings, sellable] = await Promise.all([
    tab === "browse" ? getMarketListings(user.id, { q, rarity }) : Promise.resolve([]),
    tab === "sell" ? getSellableItems(user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="pb-4">
      <MarketHeader credits={balances.CREDITS} />

      <Section className="pt-1 pb-0">
        <div className="grid grid-cols-3 gap-2">
          <StatTile icon={Store} value={stats.listings.toLocaleString("en-MY")} label="For sale" />
          <StatTile icon={Users} tone="bg-gold-soft text-gold-foreground" value={stats.sellers.toLocaleString("en-MY")} label="Sellers" />
          <StatTile icon={Clock} tone="bg-success-soft text-success" value={stats.fresh.toLocaleString("en-MY")} label="New today" />
        </div>
        <SegmentedNav
          className="mt-3"
          label="Market sections"
          items={TABS.map((t) => ({
            href: t.key === "browse" ? "/market" : `/market?tab=${t.key}`,
            label: t.label,
            active: tab === t.key,
            count: t.key === "listings" ? myListings.length : undefined,
          }))}
        />
      </Section>

      {tab === "browse" && (
        <Section className="pt-3 pb-0">
          <form action="/market" role="search" className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search items" aria-label="Search items" className="h-11 rounded-full pl-9" />
            {rarity && <input type="hidden" name="rarity" value={rarity} />}
          </form>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filter by rarity">
            {[undefined, ...(Object.keys(RARITY) as RarityKey[])].map((r) => {
              const active = rarity === r;
              return (
                <Link
                  key={r ?? "all"}
                  href={browseHref(r)}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors",
                    active ? "border-transparent bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r && <span className="size-2 rounded-full" style={{ backgroundColor: RARITY[r].hex }} aria-hidden />}
                  {r ? RARITY[r].label : "All"}
                </Link>
              );
            })}
          </div>
          {listings.length === 0 ? (
            <EmptyState
              className="mt-3"
              icon={<Store className="size-10 text-primary" />}
              title={q || rarity ? "No matching items for sale" : "Nothing for sale yet"}
              description={q || rarity ? "Try a different search or rarity." : "When other players list items, they'll show up here."}
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
                      {l.quantity} available · {maskName(l.sellerName)}
                    </>
                  }
                  right={
                    <>
                      <Price value={l.unitPrice} />
                      <BuySheet listingId={l.id} item={l.item} available={l.quantity} unitPrice={l.unitPrice} seller={maskName(l.sellerName)} />
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
                <Link href="/market?tab=sell" className="text-sm font-bold text-primary">
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
