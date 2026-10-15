"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { isRealMoneyRestrictedCountry } from "@/lib/compliance/restricted-countries";
import { upsertCountryControlAction } from "@/server/actions/admin/compliance";

type Row = {
  countryCode: string;
  siteAccess: boolean;
  freePlay: boolean;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankInstructions: string | null;
  qrImageFileId: string | null;
  usdtTrc20Address: string | null;
};

export function CountryControlsForm({ existing }: { existing: Row[] }) {
  const [selected, setSelected] = useState<string>(existing[0]?.countryCode ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const row = existing.find((r) => r.countryCode === selected);
  const restricted = isRealMoneyRestrictedCountry(selected || row?.countryCode);

  const { run, pending } = useAction(upsertCountryControlAction, {
    success: "Country settings saved",
    onSuccess: () => {
      /* page revalidates */
    },
  });

  return (
    <div className="space-y-4">
      {existing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {existing.map((r) => (
            <button
              key={r.countryCode}
              type="button"
              onClick={() => setSelected(r.countryCode)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${r.countryCode === selected ? "border-primary bg-brand-soft text-primary" : ""}`}
            >
              {r.countryCode}
              {isRealMoneyRestrictedCountry(r.countryCode) ? " (locked)" : ""}
            </button>
          ))}
        </div>
      )}
      <form
        ref={formRef}
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(new FormData(e.currentTarget));
        }}
      >
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="countryCode">Country code (ISO alpha-2)</Label>
          <Input id="countryCode" name="countryCode" defaultValue={row?.countryCode ?? ""} required maxLength={2} className="uppercase" onChange={(e) => setSelected(e.target.value.toUpperCase())} />
        </div>
        {(
          [
            ["siteAccess", "Site access", row?.siteAccess ?? true],
            ["freePlay", "Free play", row?.freePlay ?? true],
            ["depositsEnabled", "Deposits", row?.depositsEnabled ?? false],
            ["withdrawalsEnabled", "Withdrawals", row?.withdrawalsEnabled ?? false],
          ] as const
        ).map(([name, label, def]) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value="on" defaultChecked={def} disabled={restricted && (name === "depositsEnabled" || name === "withdrawalsEnabled")} />
            {label}
            {restricted && (name === "depositsEnabled" || name === "withdrawalsEnabled") ? " (hard-locked)" : ""}
          </label>
        ))}
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="usdtTrc20Address">USDT TRC20 wallet (optional override; else USDT_TRC20_WALLET env)</Label>
          <Input id="usdtTrc20Address" name="usdtTrc20Address" defaultValue={row?.usdtTrc20Address ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bankName">Bank name (optional)</Label>
          <Input id="bankName" name="bankName" defaultValue={row?.bankName ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bankAccountName">Bank account name</Label>
          <Input id="bankAccountName" name="bankAccountName" defaultValue={row?.bankAccountName ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bankAccountNumber">Bank account number</Label>
          <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={row?.bankAccountNumber ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bankInstructions">Bank instructions</Label>
          <Input id="bankInstructions" name="bankInstructions" defaultValue={row?.bankInstructions ?? ""} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="qr">QR image (optional, replaces previous)</Label>
          <Input id="qr" name="qr" type="file" accept="image/jpeg,image/png,image/webp" />
          {row?.qrImageFileId && <p className="text-xs text-muted-foreground">Current QR file: {row.qrImageFileId}</p>}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="reason">Reason (audit)</Label>
          <Input id="reason" name="reason" required placeholder="Why this change?" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save country
          </Button>
        </div>
      </form>
    </div>
  );
}
