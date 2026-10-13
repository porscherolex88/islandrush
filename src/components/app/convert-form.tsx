"use client";

import { Info, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newKey, useAction } from "@/hooks/use-action";
import { useFiatCurrency, useFormatCash } from "@/components/providers/fiat-currency-provider";
import { cashMinorToCredits, formatCredits, toDecimal, toMinor } from "@/lib/money";
import { convertAction } from "@/server/actions/wallet";

function safeMinor(v: string) {
  try {
    return /^\d+(\.\d{0,2})?$/.test(v) ? toMinor(v) : 0n;
  } catch {
    return 0n;
  }
}

export function ConvertForm({ cash, rateCash, rateCredits, initialAmount = "" }: { cash: string; rateCash: string; rateCredits: number; initialAmount?: string }) {
  const fmt = useFormatCash();
  const fiat = useFiatCurrency();
  const [amount, setAmount] = useState(initialAmount);
  const keyRef = useRef(newKey());
  const cashMinor = toMinor(cash);
  const minor = safeMinor(amount);
  const credits = cashMinorToCredits(minor, toMinor(rateCash), BigInt(rateCredits));
  const over = minor > cashMinor;
  const valid = minor > 0n && !over && credits > 0n;

  const { run, pending } = useAction(convertAction, {
    success: (d) => `Converted ${fmt(d.cashAmount)} to ${formatCredits(d.credits)} Credits`,
    onSuccess: () => {
      setAmount("");
      keyRef.current = newKey();
    },
  });

  const pctOf = (pct: bigint) => setAmount(toDecimal((cashMinor * pct) / 100n).replace(/\.00$/, ""));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="cash" className="text-base font-semibold">
            How much Cash?
          </Label>
          <span className="text-sm text-muted-foreground tabular">Available: {fmt(cash)}</span>
        </div>
        {fiat === "USD" ? <p className="mt-1 text-xs text-muted-foreground">Enter RM amounts; balances and summaries use USD.</p> : null}
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface px-3">
          <span className="font-heading text-2xl font-bold text-muted-foreground">RM</span>
          <Input
            id="cash"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            className="h-14 border-0 bg-transparent px-0 font-heading text-3xl font-bold focus-visible:ring-0"
            aria-invalid={over}
          />
        </div>
        <div className="mt-3 flex gap-2">
          {[25n, 50n, 100n].map((p) => (
            <button key={p.toString()} type="button" onClick={() => pctOf(p)} className="h-12 flex-1 rounded-full border bg-card text-sm font-semibold hover:bg-muted" disabled={cashMinor === 0n}>
              {p === 100n ? "All" : `${p}%`}
            </button>
          ))}
        </div>
        {over && <p className="mt-2 text-sm font-medium text-destructive">That is more than your Cash balance.</p>}
      </div>

      <div className="rounded-2xl border-2 border-gold/40 bg-gold-soft/60 p-4" aria-live="polite">
        <p className="text-sm font-bold text-gold-foreground">Summary</p>
        {minor > 0n ? (
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">You are converting</dt>
              <dd className="font-semibold tabular">{fmt(minor)} Cash</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">You will receive</dt>
              <dd className="font-heading text-xl font-extrabold tabular">{formatCredits(credits)} Credits</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Rate</dt>
              <dd className="tabular">
                {fmt(rateCash)} = {formatCredits(rateCredits)} Credits
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Cash left after</dt>
              <dd className="tabular">{fmt(over ? 0n : cashMinor - minor)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Enter an amount to see how many Credits you will get. Rate: {fmt(rateCash)} = {formatCredits(rateCredits)} Credits.
          </p>
        )}
      </div>

      <ConfirmDialog
        trigger={
          <Button size="pill" variant="gold" className="w-full" disabled={!valid || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {valid ? `Convert ${fmt(minor)} → ${formatCredits(credits)} Credits` : "Convert"}
          </Button>
        }
        title="Convert Cash to Credits?"
        description={`${fmt(minor)} from your Cash will become ${formatCredits(credits)} Credits. Credits are used to play and cannot be converted back to Cash.`}
        confirmLabel="Yes, convert"
        onConfirm={() => run({ cashAmount: toDecimal(minor), idempotencyKey: keyRef.current })}
      />
      <p className="flex gap-2 rounded-xl bg-surface p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Credits cannot be converted back to Cash. Cash rewards you win go to Pending, then Withdrawable.
      </p>
    </div>
  );
}
