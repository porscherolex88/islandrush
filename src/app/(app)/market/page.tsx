import { Search, Store, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BuySheet } from "@/components/app/market";
import { ItemTile, Price } from "@/components/app/market-item";
import { Section } from "@/components/app/mobile-header";
import { MarketHeader } from "@/components/app/root-page-header";
import { EmptyState } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { maskName } from "@/lib/mask-name";
import { RARITY, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { getBalances } from "@/server/services/ledger";
import { getMarketListings, getMyListings } from "@/server/services/market";

export const metadata: Metadata = { title: "Market" };

export default async function MarketPage({ searchParams }: PageProps<"/market">) {
  const user = await requireUser();
  const sp = await searchParams;
  if (sp.tab === "sell" || sp.tab === "listings") redirect("/market/sell");
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const rarity = typeof sp.rarity === "string" && sp.rarity in RARITY ? (sp.rarity as RarityKey) : undefined;
  const browseHref = (r?: RarityKey) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (r) params.set("rarity", r);
    const qs = params.toString();
    return qs ? `/market?${qs}` : "/market";
  };

  const [balances, listings, myListings] = await Promise.all([getBalances(user.id), getMarketListings(user.id, { q, rarity }), getMyListings(user.id)]);

  return (
    <div className="pb-4">
      <MarketHeader credits={balances.CREDITS} />

      <Section className="pt-1 pb-0">
        <div className="flex gap-2">
          <form action="/market" role="search" className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search items" aria-label="Search items" className="h-11 rounded-full pl-9" />
            {rarity && <input type="hidden" name="rarity" value={rarity} />}
          </form>
          <Link
            href="/market/sell"
            className="relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-bold text-background"
            aria-label={myListings.length ? `Sell items, ${myListings.length} listed` : "Sell items"}
          >
            <Tag className="size-4" aria-hidden /> Sell
            {myListings.length > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-background px-1 text-[11px] leading-5 font-extrabold text-foreground tabular">{myListings.length}</span>
            )}
          </Link>
        </div>
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
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {listings.map((l) => (
              <ItemTile
                key={l.id}
                icon={l.item.icon}
                rarity={l.item.rarity}
                name={l.item.name}
                detail={
                  <>
                    {l.quantity} available · {maskName(l.sellerName)}
                  </>
                }
                price={<Price value={l.unitPrice} />}
                action={<BuySheet listingId={l.id} item={l.item} available={l.quantity} unitPrice={l.unitPrice} seller={maskName(l.sellerName)} />}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
