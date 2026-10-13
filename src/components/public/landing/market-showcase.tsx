"use client";

import { ArrowLeftRight, Check, Coins, Library, MousePointer2, Tag } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { RARITY, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { SectionHeading } from "../marketing";

type Item = { name: string; rarity: RarityKey; art: string; base: number };

const ITEMS: Item[] = [
  { name: "Brass Compass", rarity: "COMMON", art: "/illustrations/items/compass.webp", base: 45 },
  { name: "Tide Pearl", rarity: "UNCOMMON", art: "/illustrations/items/pearl.webp", base: 120 },
  { name: "Jade Idol", rarity: "RARE", art: "/illustrations/items/idol.webp", base: 480 },
  { name: "Sun Amulet", rarity: "RARE", art: "/illustrations/items/amulet.webp", base: 520 },
  { name: "Glow Shard", rarity: "EPIC", art: "/illustrations/items/shard.webp", base: 1250 },
  { name: "Crown Jewel", rarity: "LEGENDARY", art: "/illustrations/items/crown.webp", base: 6000 },
];

const NAMES = ["A***n", "H***z", "N***l", "S***i", "W***g", "P***a", "J***e", "T***n", "M***y", "R***o"];

const POINTS = [
  { icon: Library, title: "Collect", body: "Everything you own sits on your Collections page, sellable items and keepsakes side by side." },
  { icon: Tag, title: "Sell", body: "List spare items on the Market at your own price in Credits." },
  { icon: ArrowLeftRight, title: "Buy", body: "Pick up items from other players with your Credits." },
];

type Listing = { id: number; item: Item; price: number; seller: string; soldTo?: string; fresh?: boolean };
type Trade = { id: number; kind: "bought" | "listed"; who: string; item: Item; price: number };

const INITIAL: Listing[] = [
  { id: 1, item: ITEMS[5], price: 6000, seller: "M***y" },
  { id: 2, item: ITEMS[4], price: 1250, seller: "T***n" },
  { id: 3, item: ITEMS[2], price: 480, seller: "S***i" },
  { id: 4, item: ITEMS[3], price: 540, seller: "R***o" },
  { id: 5, item: ITEMS[1], price: 120, seller: "W***g" },
  { id: 6, item: ITEMS[0], price: 45, seller: "J***e" },
];

const INITIAL_TRADES: Trade[] = [
  { id: 101, kind: "bought", who: "A***n", item: ITEMS[4], price: 1200 },
  { id: 102, kind: "listed", who: "P***a", item: ITEMS[1], price: 125 },
  { id: 103, kind: "bought", who: "N***l", item: ITEMS[2], price: 470 },
  { id: 104, kind: "listed", who: "H***z", item: ITEMS[3], price: 520 },
  { id: 105, kind: "bought", who: "R***o", item: ITEMS[5], price: 5800 },
  { id: 106, kind: "listed", who: "S***i", item: ITEMS[0], price: 50 },
];

const TICK_MS = 3400;
const MAX_TRADES = 6;

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function priceFor(item: Item) {
  const raw = item.base * (0.9 + Math.random() * 0.25);
  const step = raw >= 2000 ? 50 : raw >= 200 ? 10 : 5;
  return Math.max(step, Math.round(raw / step) * step);
}

const fmt = (n: number) => n.toLocaleString("en-US");

function Price({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-heading font-extrabold tabular", className)}>
      <Coins className="size-3.5 text-primary" aria-hidden />
      {fmt(value)}
    </span>
  );
}

function ListingCard({ listing, index, still }: { listing: Listing; index: number; still: boolean }) {
  const r = RARITY[listing.item.rarity];
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={listing.id}
        initial={{ opacity: 0, y: 16, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="relative h-full overflow-hidden rounded-2xl border bg-card p-2 shadow-[0_1px_0_rgb(10_11_13/0.04)] sm:p-2.5"
      >
        <div className={cn("relative grid aspect-[5/4] place-items-center overflow-hidden rounded-xl", r.bg)}>
          <motion.span
            className="absolute inset-[12%]"
            animate={still ? undefined : { y: [0, -5, 0] }}
            transition={{ duration: 3.2 + (index % 3) * 0.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image src={listing.item.art} alt="" fill sizes="(min-width: 1024px) 160px, 40vw" className="object-contain drop-shadow-[0_10px_12px_rgb(10_11_13/0.25)]" />
          </motion.span>
          <span className={cn("absolute top-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold", r.text)}>{r.label}</span>
          <AnimatePresence>
            {listing.fresh && (
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
              >
                New
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-2 truncate px-0.5 text-sm font-semibold">{listing.item.name}</p>
        <div className="mt-0.5 flex items-center justify-between gap-2 px-0.5">
          <Price value={listing.price} className="text-sm" />
          <span className="truncate text-[11px] text-muted-foreground">by {listing.seller}</span>
        </div>

        <AnimatePresence>
          {listing.soldTo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 grid place-items-center rounded-2xl bg-primary/92 text-center text-primary-foreground backdrop-blur-[2px]"
            >
              <div>
                <motion.span
                  initial={{ scale: 0.4, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 16 }}
                  className="mx-auto grid size-10 place-items-center rounded-full bg-white text-primary"
                >
                  <Check className="size-5" strokeWidth={3} aria-hidden />
                </motion.span>
                <p className="mt-2 font-heading text-lg font-extrabold">Sold</p>
                <p className="text-xs text-white/80">to {listing.soldTo}</p>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [6, 0, -14, -26] }}
                  transition={{ duration: 1.4, times: [0, 0.2, 0.7, 1] }}
                  className="absolute inset-x-0 top-3 text-sm font-extrabold"
                >
                  +{fmt(listing.price)} Credits
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const bought = trade.kind === "bought";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5"
    >
      <span className="relative size-10 shrink-0 rounded-xl bg-white/10">
        <Image src={trade.item.art} alt="" fill sizes="40px" className="object-contain p-1" />
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug">
        <span className="block truncate">
          <span className="font-semibold">{trade.who}</span> <span className="text-white/60">{trade.kind}</span>
        </span>
        <span className="block truncate text-white/80">{trade.item.name}</span>
      </span>
      <span className="text-right">
        <span className={cn("block text-[10px] font-bold tracking-wider uppercase", bought ? "text-amber-300" : "text-white/50")}>{bought ? "Sale" : "Listing"}</span>
        <span className="inline-flex items-center gap-1 font-heading text-sm font-extrabold tabular">
          <Coins className="size-3.5 text-amber-300" aria-hidden />
          {fmt(trade.price)}
        </span>
      </span>
    </motion.li>
  );
}

/** A storefront preview: shoppers glide in, buy a listing, and a seller restocks the slot. Activity is simulated. */
function MarketPreview() {
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const inView = useInView(root, { amount: 0.3 });
  const reduced = useReducedMotion();
  const [listings, setListingsState] = useState(INITIAL);
  const shelf = useRef(INITIAL);
  const [trades, setTrades] = useState(INITIAL_TRADES);
  const [cursor, setCursor] = useState({ x: 0, y: 0, name: NAMES[0], shown: false, press: 0 });
  const nextId = useRef(1000);
  const busy = useRef(new Set<number>());
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const setListings = useCallback((fn: (all: Listing[]) => Listing[]) => {
    shelf.current = fn(shelf.current);
    setListingsState(shelf.current);
  }, []);

  const pushTrade = useCallback((t: Omit<Trade, "id">) => {
    const trade = { ...t, id: nextId.current++ };
    setTrades((list) => [trade, ...list].slice(0, MAX_TRADES));
  }, []);

  const tick = useCallback(() => {
    const free = [0, 1, 2, 3, 4, 5].filter((i) => !busy.current.has(i));
    const cards = grid.current?.children;
    if (!free.length || !cards) return;
    const slot = pick(free);
    const card = cards[slot] as HTMLElement;
    const buyer = pick(NAMES.filter((n) => n !== shelf.current[slot].seller));
    busy.current.add(slot);

    setCursor((c) => ({ ...c, name: buyer, shown: true, x: card.offsetLeft + card.offsetWidth * 0.62, y: card.offsetTop + card.offsetHeight * 0.48 }));

    later(() => {
      setCursor((c) => ({ ...c, press: c.press + 1 }));
      const sold = shelf.current[slot];
      pushTrade({ kind: "bought", who: buyer, item: sold.item, price: sold.price });
      setListings((all) => all.map((l, i) => (i === slot ? { ...l, soldTo: buyer } : l)));
    }, 850);

    later(() => setCursor((c) => ({ ...c, shown: false })), 1500);

    later(() => {
      const onShelf = new Set(shelf.current.filter((_, i) => i !== slot).map((l) => l.item.name));
      const item = pick(ITEMS.filter((it) => !onShelf.has(it.name)));
      const fresh: Listing = { id: nextId.current++, item, price: priceFor(item), seller: pick(NAMES.filter((n) => n !== buyer)), fresh: true };
      pushTrade({ kind: "listed", who: fresh.seller, item, price: fresh.price });
      setListings((all) => all.map((l, i) => (i === slot ? fresh : l)));
    }, 2300);

    later(() => {
      setListings((all) => all.map((l, i) => (i === slot ? { ...l, fresh: false } : l)));
      busy.current.delete(slot);
    }, 4200);
  }, [later, pushTrade, setListings]);

  useEffect(() => {
    if (!inView || reduced) return;
    const first = window.setTimeout(tick, 900);
    const id = window.setInterval(tick, TICK_MS);
    const pending = timers.current;
    const taken = busy.current;
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      pending.forEach(window.clearTimeout);
      pending.length = 0;
      taken.clear();
      setCursor((c) => ({ ...c, shown: false }));
      setListings((all) => all.map((l) => ({ ...l, soldTo: undefined, fresh: false })));
    };
  }, [inView, reduced, tick, setListings]);

  return (
    <div ref={root} className="rounded-[2rem] border bg-surface p-2 sm:p-3" role="img" aria-label="Preview of the Market with example listings and trades">
      <div className="grid gap-2 sm:gap-3 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-3xl bg-background p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <p className="font-heading text-lg font-extrabold">Market</p>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-primary">Preview</span>
            </div>
            <div className="flex gap-1.5 text-[11px] font-semibold">
              <span className="rounded-full bg-foreground px-2.5 py-1 text-background">All</span>
              <span className="hidden rounded-full border px-2.5 py-1 text-muted-foreground sm:inline">Rare+</span>
              <span className="hidden rounded-full border px-2.5 py-1 text-muted-foreground sm:inline">Under 500</span>
            </div>
          </div>
          <div className="relative">
            <ul ref={grid} className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {listings.map((l, i) => (
                <li key={i} className="min-w-0">
                  <ListingCard listing={l} index={i} still={!!reduced} />
                </li>
              ))}
            </ul>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 z-20"
              initial={false}
              animate={{ x: cursor.x, y: cursor.y, opacity: cursor.shown ? 1 : 0 }}
              transition={{ x: { type: "spring", stiffness: 90, damping: 18 }, y: { type: "spring", stiffness: 90, damping: 18 }, opacity: { duration: 0.25 } }}
            >
              <motion.span key={cursor.press} className="block" initial={{ scale: 1 }} animate={{ scale: [1, 0.8, 1] }} transition={{ duration: 0.25 }}>
                <MousePointer2 className="size-6 fill-primary text-white drop-shadow-[0_2px_4px_rgb(10_11_13/0.3)]" strokeWidth={1.5} />
              </motion.span>
              <span className="mt-0.5 ml-4 block w-max rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground shadow-md">{cursor.name}</span>
            </motion.div>
          </div>
        </div>

        <div className="flex flex-col rounded-3xl bg-ink p-3 text-white sm:p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="font-heading text-lg font-extrabold">Recent trades</p>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
              <span className="relative flex size-2">
                {!reduced && <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300 opacity-75" />}
                <span className="relative inline-flex size-2 rounded-full bg-amber-300" />
              </span>
              Example
            </span>
          </div>
          <ul className="flex h-[16.5rem] flex-col gap-2 overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
            <AnimatePresence initial={false} mode="popLayout">
              {trades.map((t) => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </AnimatePresence>
          </ul>
          <p className="mt-3 px-1 text-[11px] text-white/45">Simulated activity for illustration.</p>
        </div>
      </div>
    </div>
  );
}

export function MarketShowcase() {
  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-12">
        <SectionHeading
          eyebrow="Collect and trade"
          title="Every item has a home, or a buyer"
          description="Five rarities, from Common to Legendary. Keep what moves your adventure forward and trade the rest with other explorers."
          className="mb-0 sm:mb-0"
        />
        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                <Icon className="size-[1.125rem]" aria-hidden />
              </span>
              <span>
                <span className="block font-bold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-10 sm:mt-12">
        <MarketPreview />
      </div>
    </div>
  );
}
