"use client";

import { Coins, Info, Loader2, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAction } from "@/hooks/use-action";
import { formatCredits } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { buyListingAction, cancelListingAction, createListingAction } from "@/server/actions/market";
import { Token } from "./art";

type ItemSummary = { name: string; icon: string; rarity: string };

function QuantityRow({ value, max, hint, onChange }: { value: number; max: number; hint: string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Quantity</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
        <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full bg-background shadow-sm disabled:shadow-none" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Decrease quantity">
          <Minus />
        </Button>
        <span className="min-w-9 text-center font-heading text-lg font-extrabold tabular" aria-live="polite">
          {value}
        </span>
        <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full bg-background shadow-sm disabled:shadow-none" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity">
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function ItemHeading({ item, detail }: { item: ItemSummary; detail: string }) {
  const r = rarityOf(item.rarity);
  return (
    <div className="flex items-center gap-3">
      <Token icon={item.icon} rarity={item.rarity} size="lg" />
      <div className="min-w-0 text-left">
        <SheetTitle className="font-heading text-xl">{item.name}</SheetTitle>
        <SheetDescription>
          <span className={r.text}>{r.label}</span> · {detail}
        </SheetDescription>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between border-t pt-3" : "flex items-center justify-between text-sm"}>
      <dt className={strong ? "text-sm font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "inline-flex items-center gap-1.5 font-heading text-xl font-extrabold tabular" : "font-semibold tabular"}>
        {strong && <Coins className="size-5 text-gold" aria-hidden />}
        {value}
        {strong && <span className="text-sm font-semibold text-muted-foreground">Credits</span>}
      </dd>
    </div>
  );
}

export function BuySheet({ listingId, item, available, unitPrice, seller }: { listingId: string; item: ItemSummary; available: number; unitPrice: number; seller: string }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [key, setKey] = useState("");
  const { run, pending } = useAction(buyListingAction, {
    success: (d) => `Bought ${d.quantity} x ${item.name}`,
    onSuccess: () => setOpen(false),
  });
  const total = unitPrice * qty;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQty(1);
          setKey(crypto.randomUUID());
        }
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm" variant="gold" className="h-9 rounded-full px-4 text-sm font-bold">
          Buy
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <ItemHeading item={item} detail={`Sold by ${seller}`} />
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {available > 1 && <QuantityRow value={qty} max={available} hint={`${available} available`} onChange={setQty} />}
          <dl className="space-y-3 rounded-2xl border bg-card p-4">
            <Row label="Price each" value={`${formatCredits(unitPrice)} Credits`} />
            {qty > 1 && <Row label="Quantity" value={`x ${qty}`} />}
            <Row label="Total" value={formatCredits(total)} strong />
          </dl>
          <Button className="h-12 w-full text-base" size="pill" variant="gold" disabled={pending} onClick={() => run({ listingId, quantity: qty, idempotencyKey: key })}>
            {pending && <Loader2 className="animate-spin" />}
            Buy for {formatCredits(total)} Credits
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SellSheet({ itemId, item, owned, feePct, minPrice, maxPrice }: { itemId: string; item: ItemSummary; owned: number; feePct: number; minPrice: number; maxPrice: number }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const { run, pending } = useAction(createListingAction, {
    success: (d) => `${d.itemName} listed on the market`,
    onSuccess: () => setOpen(false),
  });
  const unit = /^\d+$/.test(price) ? Number(price) : 0;
  const total = unit * qty;
  const fee = Math.floor((total * feePct) / 100);
  const valid = unit >= minPrice && unit <= maxPrice;
  const priceError =
    price === "" ? null : unit < minPrice ? `Minimum price is ${formatCredits(minPrice)} Credits` : unit > maxPrice ? `Maximum price is ${formatCredits(maxPrice)} Credits` : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQty(1);
          setPrice("");
        }
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-9 rounded-full px-4 text-sm font-bold">
          Sell
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <ItemHeading item={item} detail={`You own ${owned}`} />
        </SheetHeader>
        <form
          className="space-y-4 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) run({ itemId, quantity: qty, unitPrice: unit });
          }}
        >
          {owned > 1 && <QuantityRow value={qty} max={owned} hint={`You own ${owned}`} onChange={setQty} />}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor={`price-${itemId}`} className="font-semibold">
                Price each
              </Label>
              <span className="text-xs text-muted-foreground tabular">
                {formatCredits(minPrice)} - {formatCredits(maxPrice)} Credits
              </span>
            </div>
            <div className="relative">
              <Coins className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-gold" aria-hidden />
              <Input
                id={`price-${itemId}`}
                inputMode="numeric"
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 9))}
                autoComplete="off"
                aria-invalid={priceError ? true : undefined}
                aria-describedby={priceError ? `price-error-${itemId}` : undefined}
                className="h-12 rounded-xl pr-20 pl-12 font-heading text-lg font-bold tabular md:text-lg"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-semibold text-muted-foreground">Credits</span>
            </div>
            {priceError && (
              <p id={`price-error-${itemId}`} className="text-xs font-medium text-destructive">
                {priceError}
              </p>
            )}
          </div>
          <dl className="space-y-3 rounded-2xl border bg-card p-4">
            <Row label={qty > 1 ? `Sale price (${qty} x ${formatCredits(unit)})` : "Sale price"} value={`${formatCredits(total)} Credits`} />
            <Row label={`Market fee (${feePct}%)`} value={`-${formatCredits(fee)} Credits`} />
            <Row label="You receive" value={formatCredits(total - fee)} strong />
          </dl>
          <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Listed items leave your collection until they sell. Cancel any time to get unsold items back.
          </p>
          <Button type="submit" className="h-12 w-full text-base" size="pill" variant="gold" disabled={!valid || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {unit === 0 ? "Enter a price to continue" : qty > 1 ? `List ${qty} for sale` : "List for sale"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function CancelListingButton({ listingId }: { listingId: string }) {
  const { run, pending } = useAction(cancelListingAction, { success: "Listing cancelled. Unsold items are back in your collection." });
  return (
    <Button size="sm" variant="outline" className="h-9 rounded-full px-4 text-sm font-bold" disabled={pending} onClick={() => run(listingId)}>
      {pending && <Loader2 className="animate-spin" />}
      Cancel
    </Button>
  );
}
