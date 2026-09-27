"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { newKey, useAction } from "@/hooks/use-action";
import { formatMYR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createDepositAction } from "@/server/actions/wallet";
import { CopyButton } from "./copy-button";

type PaymentAccount = { id: string; bankName: string; accountName: string; accountNumber: string; instructions: string };

const METHOD_LABEL: Record<string, string> = { BANK_TRANSFER: "Bank transfer", DUITNOW: "DuitNow" };
const QUICK = ["100", "300", "500", "1000"];

export function DepositForm({
  accounts,
  methods,
  min,
  max,
  proofRequired,
  defaultName,
}: {
  accounts: PaymentAccount[];
  methods: string[];
  min: string;
  max: string;
  proofRequired: boolean;
  defaultName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const keyRef = useRef<string>(newKey());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0] ?? "BANK_TRANSFER");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [done, setDone] = useState<{ amount: string } | null>(null);
  const account = accounts.find((a) => a.id === accountId);

  const { run, pending } = useAction(createDepositAction, {
    success: (d) => `Deposit of ${formatMYR(d.amount)} submitted for review`,
    onSuccess: (d) => {
      setDone({ amount: d.amount });
      keyRef.current = newKey();
      formRef.current?.reset();
      setAmount("");
      setFileName(null);
    },
  });

  if (done) {
    return (
      <div className="space-y-3 rounded-2xl border bg-success-soft/60 p-5 text-center">
        <p className="text-4xl" aria-hidden>
          ✅
        </p>
        <p className="font-heading text-lg font-bold">Deposit submitted</p>
        <p className="text-sm text-muted-foreground">
          We&apos;re checking your {formatMYR(done.amount)} transfer. You&apos;ll get a notification as soon as it&apos;s added to your Cash wallet, usually within a few hours.
        </p>
        <Button variant="outline" onClick={() => setDone(null)}>
          Make another deposit
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("idempotencyKey", keyRef.current);
        fd.set("method", method);
        fd.set("paymentAccountId", accountId);
        run(fd);
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">1. Transfer to LootBox</legend>
        {accounts.length > 1 && (
          <div className="flex gap-2" role="radiogroup" aria-label="Payment account">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === accountId}
                onClick={() => setAccountId(a.id)}
                className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-semibold", a.id === accountId ? "border-primary bg-brand-soft text-primary" : "bg-card")}
              >
                {a.bankName}
              </button>
            ))}
          </div>
        )}
        {account ? (
          <div className="space-y-2 rounded-2xl border bg-surface p-4 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Bank</span>
              <span className="font-semibold">{account.bankName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Account name</span>
              <span className="text-right font-semibold">{account.accountName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Account number</span>
              <span className="flex items-center gap-1 font-mono font-semibold">
                {account.accountNumber}
                <CopyButton value={account.accountNumber} />
              </span>
            </div>
            {account.instructions && <p className="border-t pt-2 text-xs text-muted-foreground">{account.instructions}</p>}
          </div>
        ) : (
          <p className="rounded-xl bg-muted p-3 text-sm">Deposit details are being updated. Please check back shortly or contact support.</p>
        )}
      </fieldset>

      <fieldset className="space-y-4" disabled={!account || pending}>
        <legend className="text-sm font-bold">2. Tell us about your transfer</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="amount">Amount (RM)</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} required className="h-12 text-lg font-semibold" />
          <div className="flex gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setAmount(q)} className="flex-1 rounded-lg border bg-card py-1.5 text-xs font-semibold hover:bg-muted">
                RM{q}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum {formatMYR(min)}, maximum {formatMYR(max)}
          </p>
        </div>
        {methods.length > 1 && (
          <div className="grid gap-1.5">
            <Label>Method</Label>
            <div className="flex gap-2" role="radiogroup" aria-label="Deposit method">
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={m === method}
                  onClick={() => setMethod(m)}
                  className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-semibold", m === method ? "border-primary bg-brand-soft text-primary" : "bg-card")}
                >
                  {METHOD_LABEL[m] ?? m}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="reference">Transfer reference</Label>
          <Input id="reference" name="reference" placeholder="e.g. MBB20260927123456" required maxLength={80} className="h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payerName">Sender account name</Label>
          <Input id="payerName" name="payerName" defaultValue={defaultName} required maxLength={120} className="h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="proof">Proof of transfer {proofRequired ? "" : "(optional)"}</Label>
          <label htmlFor="proof" className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-card p-3 text-sm hover:bg-surface">
            <Upload className="size-5 text-muted-foreground" aria-hidden />
            <span className="flex-1 truncate">{fileName ?? "Upload a screenshot or PDF (max 3MB)"}</span>
          </label>
          <input
            id="proof"
            name="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            required={proofRequired}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" name="note" rows={2} maxLength={500} />
        </div>
      </fieldset>

      <Button size="xl" className="w-full" type="submit" disabled={!account || pending}>
        {pending && <Loader2 className="animate-spin" />}
        Submit deposit
      </Button>
      <p className="text-center text-xs text-muted-foreground">Deposits are reviewed manually. Only transfer from an account in your own name.</p>
    </form>
  );
}
