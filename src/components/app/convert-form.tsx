"use client";

import { ArrowDown, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newKey, useAction } from "@/hooks/use-action";
import { cashMinorToCredits, formatCredits, formatMYR, toDecimal, toMinor } from "@/lib/money";
import { convertAction } from "@/server/actions/wallet";

function safeMinor(v: string) {
  try {
    return /^\d+(\.\d{0,2})?$/.test(v) ? toMinor(v) : 0n;
  } catch {
    return 0n;
  }
}

export function ConvertForm({ cash, rateCash, rateCredits }: { cash: string; rateCash: string; rateCredits: number }) {
  const [amount, setAmount] = useState("");
  const keyRef = useRef(newKey());
  const cashMinor = toMinor(cash);
  const minor = safeMinor(amount);
  const credits = cashMinorToCredits(minor, toMinor(rateCash), BigInt(rateCredits));
  const over = minor > cashMinor;
  const valid = minor > 0n && !over && credits > 0n;

  const { run, pending } = useAction(convertAction, {
    success: (d) => `Converted ${formatMYR(d.cashAmount)} to ${formatCredits(d.credits)} Credits`,
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
          <Label htmlFor="cash">You convert</Label>
          <span className="text-xs text-muted-foreground tabular">Cash: {formatMYR(cash)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-heading text-2xl font-bold text-muted-foreground">RM</span>
          <Input
            id="cash"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            className="h-12 border-0 px-0 font-heading text-3xl font-bold shadow-none focus-visible:ring-0"
            aria-invalid={over}
          />
        </div>
        <div className="mt-2 flex gap-2">
          {[25n, 50n, 100n].map((p) => (
            <button key={p.toString()} type="button" onClick={() => pctOf(p)} className="flex-1 rounded-lg border bg-surface py-1.5 text-xs font-semibold hover:bg-muted" disabled={cashMinor === 0n}>
              {p === 100n ? "Max" : `${p}%`}
            </button>
          ))}
        </div>
        {over && <p className="mt-2 text-xs font-medium text-destructive">That's more than your Cash balance.</p>}
      </div>
      <div className="-my-2 flex justify-center">
        <span className="grid size-9 place-items-center rounded-full border bg-background shadow-card">
          <ArrowDown className="size-4" aria-hidden />
        </span>
      </div>
      <div className="rounded-2xl bg-gold-soft p-4">
        <p className="text-sm font-medium text-gold-foreground">You receive</p>
        <p className="font-heading text-3xl font-bold tabular" aria-live="polite">
          {formatCredits(credits)} <span className="text-lg">Credits</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Rate: {formatMYR(rateCash)} = {formatCredits(rateCredits)} Credits
        </p>
      </div>
      <ConfirmDialog
        trigger={
          <Button size="xl" className="w-full" disabled={!valid || pending}>
            {pending && <Loader2 className="animate-spin" />}
            Convert
          </Button>
        }
        title="Convert Cash to Credits?"
        description={`${formatMYR(minor)} from your Cash wallet will become ${formatCredits(credits)} Credits. Credits are used for games and can't be converted back to Cash.`}
        confirmLabel="Convert now"
        onConfirm={() => run({ cashAmount: toDecimal(minor), idempotencyKey: keyRef.current })}
      />
      <p className="text-center text-xs text-muted-foreground">Credits are for play only. Cash rewards you win go to Pending Rewards, then Withdrawable.</p>
    </div>
  );
}
