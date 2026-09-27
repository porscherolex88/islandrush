"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newKey, useAction } from "@/hooks/use-action";
import { maskAccount } from "@/lib/format";
import { formatMYR, toDecimal, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { cancelWithdrawalAction, requestWithdrawalAction } from "@/server/actions/wallet";

type Account = { id: string; bankName: string; accountName: string; accountNumber: string; isDefault: boolean };

export function WithdrawForm({ accounts, available, min, max }: { accounts: Account[]; available: string; min: string; max: string }) {
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
      <div className="rounded-2xl border border-dashed p-5 text-center">
        <p className="font-semibold">Add a bank account first</p>
        <p className="mt-1 text-sm text-muted-foreground">Withdrawals are paid to a bank account in your name.</p>
        <Button asChild className="mt-3">
          <Link href="/app/account/withdrawal-accounts">Add bank account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="w-amount">Amount (RM)</Label>
          <button type="button" className="text-xs font-semibold text-primary" onClick={() => setAmount(toDecimal(toMinor(max)).replace(/\.00$/, ""))}>
            Max {formatMYR(max)}
          </button>
        </div>
        <Input id="w-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-12 text-lg font-semibold" aria-invalid={tooLow || tooHigh} />
        <p className={cn("text-xs", tooLow || tooHigh ? "text-destructive" : "text-muted-foreground")}>
          {tooLow ? `Minimum withdrawal is ${formatMYR(min)}` : tooHigh ? `You can withdraw up to ${formatMYR(max)} right now` : `Available: ${formatMYR(available)} · Min ${formatMYR(min)}`}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label>Pay to</Label>
        <div className="space-y-2" role="radiogroup" aria-label="Withdrawal account">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={a.id === accountId}
              onClick={() => setAccountId(a.id)}
              className={cn("flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm", a.id === accountId ? "border-primary bg-brand-soft" : "bg-card")}
            >
              <span>
                <span className="block font-semibold">{a.bankName}</span>
                <span className="text-xs text-muted-foreground">
                  {a.accountName} · {maskAccount(a.accountNumber)}
                </span>
              </span>
              {a.isDefault && <span className="text-[10px] font-bold text-primary uppercase">Default</span>}
            </button>
          ))}
        </div>
        <Link href="/app/account/withdrawal-accounts" className="text-xs font-semibold text-primary">
          Manage bank accounts
        </Link>
      </div>
      <ConfirmDialog
        trigger={
          <Button size="xl" className="w-full" disabled={!valid || pending}>
            {pending && <Loader2 className="animate-spin" />}
            Request withdrawal
          </Button>
        }
        title="Confirm withdrawal"
        description={account ? `${formatMYR(minor)} will be sent to ${account.bankName} ${maskAccount(account.accountNumber)} (${account.accountName}) after review.` : ""}
        confirmLabel="Request withdrawal"
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
