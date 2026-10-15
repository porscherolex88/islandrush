"use client";

import { CheckCircle2, Landmark, Loader2, Upload, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { newKey, useAction } from "@/hooks/use-action";
import { useFiatCurrency, useFormatCash } from "@/components/providers/fiat-currency-provider";
import { cn } from "@/lib/utils";
import { createDepositAction } from "@/server/actions/wallet";
import { CopyButton } from "./copy-button";

const METHOD_LABEL: Record<string, string> = {
  USDT_TRC20: "USDT (TRC20)",
  BANK_TRANSFER: "Bank transfer",
  QR_TRANSFER: "QR transfer",
};
const QUICK = ["100", "300", "500", "1000"];

type Bank = { bankName: string; accountName: string; accountNumber: string; instructions: string };

export function DepositForm({
  methods,
  min,
  max,
  proofRequired,
  defaultName,
  reference,
  usdtAddress,
  bank,
  qrUrl,
}: {
  methods: string[];
  min: string;
  max: string;
  proofRequired: boolean;
  defaultName: string;
  reference: string;
  usdtAddress: string | null;
  bank: Bank | null;
  qrUrl: string | null;
}) {
  const fmt = useFormatCash();
  const fiat = useFiatCurrency();
  const formRef = useRef<HTMLFormElement>(null);
  const keyRef = useRef<string>(newKey());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods[0] ?? "USDT_TRC20");
  const [fileName, setFileName] = useState<string | null>(null);
  const [done, setDone] = useState<{ amount: string; cryptoExpectedAmount?: string | null } | null>(null);

  const { run, pending } = useAction(createDepositAction, {
    success: (d) =>
      d.cryptoExpectedAmount
        ? `Send exactly ${d.cryptoExpectedAmount} USDT (TRC20)`
        : `Deposit of ${fmt(d.amount)} submitted for review`,
    onSuccess: (d) => {
      setDone({ amount: d.amount, cryptoExpectedAmount: d.cryptoExpectedAmount });
      keyRef.current = newKey();
      formRef.current?.reset();
      setAmount("");
      setFileName(null);
    },
  });

  if (done) {
    return (
      <div className="space-y-3 rounded-3xl border bg-success-soft/60 p-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success text-white">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <p className="font-heading text-xl font-bold">Deposit submitted</p>
        {done.cryptoExpectedAmount ? (
          <p className="text-sm text-muted-foreground">
            Send exactly <span className="font-mono font-bold text-foreground">{done.cryptoExpectedAmount} USDT</span> on TRON (TRC20) to the address shown.
            We credit your Cash after enough network confirmations.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            We are checking your {fmt(done.amount)} transfer. We will notify you as soon as it is added to your Cash.
          </p>
        )}
        <Button variant="outline" size="pill" onClick={() => setDone(null)}>
          Make another deposit
        </Button>
      </div>
    );
  }

  const needsProof = method !== "USDT_TRC20" && proofRequired;

  return (
    <form
      ref={formRef}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("idempotencyKey", keyRef.current);
        fd.set("method", method);
        fd.set("reference", method === "USDT_TRC20" ? `USDT-${reference}` : reference);
        run(fd);
      }}
    >
      {methods.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Deposit method">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === method}
              onClick={() => setMethod(m)}
              className={cn("h-12 flex-1 rounded-full border px-3 text-sm font-semibold", m === method ? "border-primary bg-brand-soft text-primary" : "bg-card")}
            >
              {METHOD_LABEL[m] ?? m}
            </button>
          ))}
        </div>
      )}

      {method === "USDT_TRC20" && usdtAddress && (
        <section className="space-y-3" aria-labelledby="usdt-to">
          <p id="usdt-to" className="font-heading text-lg font-bold">
            Step 1: Send USDT (TRC20)
          </p>
          <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_0%,var(--ocean),var(--ocean-deep)_75%)] p-5 text-white">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-white/15">
                <Wallet className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-heading text-lg font-bold">USDT on TRON</p>
                <p className="text-sm text-white/80">TRC20 only. Other networks will not be credited.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-white/10 p-3">
              <p className="text-xs font-semibold text-white/70">Wallet address</p>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 break-all font-mono text-sm font-bold">{usdtAddress}</p>
                <CopyButton value={usdtAddress} className="h-11 shrink-0 bg-white/15 px-3 text-sm text-white hover:bg-white/25" />
              </div>
            </div>
            <p className="mt-3 text-sm text-white/80">
              After you submit, we show a unique USDT amount. Send that exact amount so we can match your payment.
            </p>
          </div>
        </section>
      )}

      {method === "BANK_TRANSFER" && bank && (
        <section className="space-y-3" aria-labelledby="transfer-to">
          <p id="transfer-to" className="font-heading text-lg font-bold">
            Step 1: Transfer to
          </p>
          <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_0%,var(--ocean),var(--ocean-deep)_75%)] p-5 text-white">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-white/15">
                <Landmark className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-heading text-lg font-bold">{bank.bankName}</p>
                <p className="text-sm text-white/80">{bank.accountName}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-white/10 p-3">
              <p className="text-xs font-semibold text-white/70">Account number</p>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 font-mono text-xl font-bold whitespace-nowrap">{bank.accountNumber}</p>
                <CopyButton value={bank.accountNumber} className="h-11 shrink-0 bg-white/15 px-3 text-sm text-white hover:bg-white/25" />
              </div>
            </div>
            <div className="mt-2 rounded-2xl border-2 border-dashed border-amber-300/70 bg-amber-300/10 p-3">
              <p className="text-xs font-semibold text-amber-200">Reference</p>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 font-mono text-xl font-bold whitespace-nowrap text-amber-100">{reference}</p>
                <CopyButton value={reference} className="h-11 shrink-0 bg-amber-300/20 px-3 text-sm text-amber-100 hover:bg-amber-300/30" />
              </div>
            </div>
            <p className="mt-3 text-sm text-white/80">{bank.instructions || "Use this reference so we can match your transfer."}</p>
          </div>
        </section>
      )}

      {method === "QR_TRANSFER" && qrUrl && (
        <section className="space-y-3">
          <p className="font-heading text-lg font-bold">Step 1: Scan QR</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="Deposit QR code" className="mx-auto max-h-64 rounded-2xl border bg-white p-3" />
          <p className="text-center text-sm text-muted-foreground">Reference: {reference}</p>
        </section>
      )}

      <fieldset className="space-y-4 rounded-3xl border bg-card p-4" disabled={pending}>
        <legend className="px-1 font-heading text-lg font-bold">
          {method === "USDT_TRC20" ? "Step 2: Request your unique amount" : "Step 2: After you transfer"}
        </legend>
        <div className="grid gap-1.5">
          <Label htmlFor="amount">Amount ({method === "USDT_TRC20" ? "USDT" : "RM"})</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} required className="h-12 text-lg font-semibold" />
          <div className="flex gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setAmount(q)} className="h-11 flex-1 rounded-full border bg-surface text-sm font-semibold hover:bg-muted">
                {method === "USDT_TRC20" || fiat !== "MYR" ? q : `RM${q}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum {fmt(min)}, maximum {fmt(max)}
          </p>
        </div>
        {method !== "USDT_TRC20" && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="payerName">Name on your bank account</Label>
              <Input id="payerName" name="payerName" defaultValue={defaultName} required maxLength={120} className="h-12" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="proof">Receipt or screenshot {needsProof ? "" : "(optional)"}</Label>
              <label htmlFor="proof" className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-surface p-3 text-sm hover:bg-muted">
                <Upload className="size-5 text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate">{fileName ?? "Upload a screenshot or PDF (max 3MB)"}</span>
              </label>
              <input
                id="proof"
                name="proof"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                required={needsProof}
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" name="note" rows={2} maxLength={500} />
        </div>
      </fieldset>

      <Button variant="gold" size="pill" className="w-full" type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {method === "USDT_TRC20" ? "Get unique amount" : "I have transferred, submit"}
      </Button>
    </form>
  );
}
