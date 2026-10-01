"use client";

import { Landmark, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newKey, useAction } from "@/hooks/use-action";
import { maskAccount } from "@/lib/format";
import { useFiatCurrency, useFormatCash } from "@/components/providers/fiat-currency-provider";
import { toDecimal, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { cancelWithdrawalAction, requestWithdrawalAction } from "@/server/actions/wallet";

type Account = { id: string; bankName: string; accountName: string; accountNumber: string; isDefault: boolean };

export function WithdrawForm({ accounts, available, min, max }: { accounts: Account[]; available: string; min: string; max: string }) {
  const fmt = useFormatCash();
  const fiat = useFiatCurrency();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "");
  const keyRef = useRef(newKey());
  let minor = 0n;
  try {
    minor = /^\d+(\.\d{0,2})?$/.test(amount) ? toMinor(amount) : 0n;
  } catch {
    minor = 0n;
  }
  const tooLow = minor > 0n && minor < toMinor(min);
  const tooHigh = minor > toMinor(max);
  const valid = minor > 0n && !tooLow && !tooHigh && Boolean(accountId);
  const account = accounts.find((a) => a.id === accountId);

  const { run, pending } = useAction(requestWithdrawalAction, {
    success: (d) => d.message,
    onSuccess: () => {
      setAmount("");
      keyRef.current = newKey();
    },
  });

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-surface/60 p-6 text-center">
        <Landmark className="mx-auto size-8 text-primary" aria-hidden />
        <p className="mt-2 font-semibold">Add a bank account first</p>
        <p className="mt-1 text-sm text-muted-foreground">Withdrawals are paid to a bank account in your name.</p>
        <Button variant="gold" asChild size="pill" className="mt-3">
          <Link href="/app/account/withdrawal-accounts">Add bank account</Link>
        </Button>
      </div>
    );
  }

  const remaining = toMinor(available) - (valid ? minor : 0n);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="w-amount" className="text-base font-semibold">
            How much?
          </Label>
          <button type="button" className="h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-brand-soft" onClick={() => setAmount(toDecimal(toMinor(max)).replace(/\.00$/, ""))}>
            Max {fmt(max)}
          </button>
        </div>
        {fiat === "USD" ? <p className="mt-1 text-xs text-muted-foreground">Withdrawals are sent in RM; enter the Ringgit amount below.</p> : null}
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-surface px-3">
          <span className="font-heading text-2xl font-bold text-muted-foreground">RM</span>
          <Input id="w-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-14 border-0 bg-transparent px-0 font-heading text-3xl font-bold focus-visible:ring-0" aria-invalid={tooLow || tooHigh} />
        </div>
        <p className={cn("mt-2 text-sm", tooLow || tooHigh ? "text-destructive" : "text-muted-foreground")}>
          {tooLow ? `The minimum withdrawal is ${fmt(min)}` : tooHigh ? `You can withdraw up to ${fmt(max)} right now` : `Minimum ${fmt(min)}, up to ${fmt(max)} right now`}
        </p>
      </div>
      <div className="grid gap-2">
        <Label className="text-base font-semibold">Send to</Label>
        <div className="space-y-2" role="radiogroup" aria-label="Withdrawal account">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={a.id === accountId}
              onClick={() => setAccountId(a.id)}
              className={cn("flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left text-sm", a.id === accountId ? "border-primary bg-brand-soft ring-1 ring-primary" : "bg-card")}
            >
              <Landmark className="size-5 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block font-semibold">{a.bankName}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {a.accountName} · {maskAccount(a.accountNumber)}
                </span>
              </span>
              {a.isDefault && <span className="text-[10px] font-bold text-primary">Default</span>}
            </button>
          ))}
        </div>
        <Link href="/app/account/withdrawal-accounts" className="flex h-11 items-center text-sm font-semibold text-primary">
          Manage bank accounts
        </Link>
      </div>

      <div className="rounded-2xl border-2 border-primary/25 bg-brand-soft/50 p-4" aria-live="polite">
        <p className="text-sm font-bold text-primary">Review</p>
        <dl className="mt-2 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">You are withdrawing</dt>
            <dd className="font-heading text-xl font-extrabold tabular">{valid ? fmt(minor) : "-"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">To</dt>
            <dd className="text-right font-semibold">
              {account ? (
                <>
                  {account.bankName} {maskAccount(account.accountNumber)}
                  <span className="block text-xs font-normal text-muted-foreground">{account.accountName}</span>
                </>
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Fee</dt>
            <dd className="font-semibold text-success">Free</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Processing</dt>
            <dd className="text-right">Checked by our team, then paid to your bank</dd>
          </div>
          <div className="flex justify-between gap-2 border-t pt-2">
            <dt className="text-muted-foreground">Withdrawable left after</dt>
            <dd className="font-semibold tabular">{fmt(remaining < 0n ? 0n : remaining)}</dd>
          </div>
        </dl>
      </div>

      <ConfirmDialog
        trigger={
          <Button variant="gold" size="pill" className="w-full" disabled={!valid || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {valid ? `Request withdrawal of ${fmt(minor)}` : "Request withdrawal"}
          </Button>
        }
        title="Confirm withdrawal"
        description={account ? `${fmt(minor)} will be sent to ${account.bankName} ${maskAccount(account.accountNumber)} (${account.accountName}) after our team checks it.` : ""}
        confirmLabel="Yes, request it"
        onConfirm={() => run({ amount: toDecimal(minor), withdrawalAccountId: accountId, idempotencyKey: keyRef.current })}
      />
    </div>
  );
}

export function CancelWithdrawalButton({ id }: { id: string }) {
  const { run } = useAction(cancelWithdrawalAction, { success: "Withdrawal cancelled. Funds returned to Withdrawable." });
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive">
          Cancel
        </Button>
      }
      title="Cancel this withdrawal?"
      description="The amount will return to your Withdrawable balance immediately."
      confirmLabel="Cancel withdrawal"
      destructive
      onConfirm={() => run(id)}
    />
  );
}
