"use client";

import { Coins, Loader2, Minus, Plus } from "lucide-react";
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

const sheetClass = "mx-auto max-w-[430px] rounded-t-3xl pb-safe";

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" size="icon" className="size-10 rounded-full" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Decrease quantity">
        <Minus />
      </Button>
      <span className="min-w-10 text-center font-heading text-xl font-extrabold tabular" aria-live="polite">
        {value}
      </span>
      <Button type="button" variant="outline" size="icon" className="size-10 rounded-full" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity">
        <Plus />
      </Button>
      <span className="text-sm text-muted-foreground">of {max}</span>
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
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "inline-flex items-center gap-1 font-heading text-lg font-extrabold tabular" : "font-semibold tabular"}>
        {strong && <Coins className="size-4 text-gold" aria-hidden />}
        {value}
      </span>
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
      <SheetContent side="bottom" className={sheetClass}>
        <SheetHeader>
          <ItemHeading item={item} detail={`Sold by ${seller}`} />
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {available > 1 && <Stepper value={qty} max={available} onChange={setQty} />}
          <div className="space-y-2 rounded-2xl border bg-card p-3">
            <Row label="Price each" value={`${formatCredits(unitPrice)} Credits`} />
            <Row label="Total" value={formatCredits(total)} strong />
          </div>
          <Button className="w-full" size="pill" variant="gold" disabled={pending} onClick={() => run({ listingId, quantity: qty, idempotencyKey: key })}>
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
      <SheetContent side="bottom" className={sheetClass}>
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
          {owned > 1 && <Stepper value={qty} max={owned} onChange={setQty} />}
          <div className="space-y-1.5">
            <Label htmlFor={`price-${itemId}`}>Price each (Credits)</Label>
            <Input
              id={`price-${itemId}`}
              inputMode="numeric"
              placeholder="e.g. 500"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 9))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2 rounded-2xl border bg-card p-3">
            <Row label="Sale price" value={`${formatCredits(total)} Credits`} />
            <Row label={`Market fee (${feePct}%)`} value={`-${formatCredits(fee)}`} />
            <Row label="You receive" value={formatCredits(total - fee)} strong />
          </div>
          <p className="text-xs text-muted-foreground">Listed items leave your collection until they sell. Cancel any time to get unsold items back.</p>
          <Button type="submit" className="w-full" size="pill" variant="gold" disabled={!valid || pending}>
            {pending && <Loader2 className="animate-spin" />}
            List for sale
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
