"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { newKey } from "@/hooks/use-action";
import { createAdjustmentAction, runReconciliationAction, withdrawalAction } from "@/server/actions/admin/ops";
import type { ReconCheck } from "@/server/services/admin-finance";

export function CompleteWithdrawalButton({ id, amount }: { id: string; amount: string }) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  return (
    <ConfirmDialog
      trigger={<Button size="sm">Mark completed</Button>}
      title={`Confirm ${amount} was paid out`}
      description="Only complete after the bank transfer has been sent. This settles the withdrawal in the ledger."
      confirmLabel="Complete"
      onConfirm={async () => {
        const r = await withdrawalAction(id, "complete", null, ref);
        if (r.ok) {
          toast.success("Withdrawal completed");
          router.refresh();
        } else toast.error(r.error);
        return r;
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="payout-ref">Bank payout reference</Label>
        <Input id="payout-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. IBG20260927-001" />
      </div>
    </ConfirmDialog>
  );
}

export function AdjustmentForm({ defaultUserId = "" }: { defaultUserId?: string }) {
  const router = useRouter();
  const key = useRef(newKey());
  const [v, setV] = useState({ userId: defaultUserId, account: "CASH", direction: "CREDIT", amount: "", reason: "", note: "" });
  const [pending, setPending] = useState(false);
  const unit = v.account === "CREDITS" ? "Credits" : "RM";
  const valid = v.userId.trim() && /^\d+(\.\d{1,2})?$/.test(v.amount) && Number(v.amount) > 0 && v.reason.trim().length >= 5;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="adj-user">User ID</Label>
          <Input id="adj-user" value={v.userId} onChange={(e) => setV({ ...v, userId: e.target.value })} placeholder="Paste the user ID from the user page" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adj-acct">Account</Label>
          <select id="adj-acct" value={v.account} onChange={(e) => setV({ ...v, account: e.target.value })} className="h-9 rounded-md border bg-background px-2.5 text-sm">
            <option value="CASH">Cash wallet (RM)</option>
            <option value="CREDITS">Credits</option>
            <option value="WITHDRAWABLE">Withdrawable (RM)</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adj-dir">Direction</Label>
          <select id="adj-dir" value={v.direction} onChange={(e) => setV({ ...v, direction: e.target.value })} className="h-9 rounded-md border bg-background px-2.5 text-sm">
            <option value="CREDIT">Credit (add to user)</option>
            <option value="DEBIT">Debit (remove from user)</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adj-amt">Amount ({unit})</Label>
          <Input id="adj-amt" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value.trim() })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adj-reason">Reason (shown to user)</Label>
          <Input id="adj-reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} maxLength={300} placeholder="e.g. Goodwill credit for delayed deposit" />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="adj-note">Internal note</Label>
          <Textarea id="adj-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} rows={2} placeholder="Ticket number, approval, context" />
        </div>
      </div>
      <ConfirmDialog
        trigger={
          <Button disabled={!valid || pending}>
            {pending && <Loader2 className="animate-spin" />}
            Review adjustment
          </Button>
        }
        title={`${v.direction === "CREDIT" ? "Credit" : "Debit"} ${v.amount} ${unit}?`}
        description={`This posts a new balanced ledger transaction against the adjustment account for user ${v.userId.slice(0, 12)}. Ledger history is never edited. The user is notified.`}
        confirmLabel="Post adjustment"
        destructive={v.direction === "DEBIT"}
        onConfirm={async () => {
          setPending(true);
          const r = await createAdjustmentAction({ ...v, direction: v.direction as "CREDIT" | "DEBIT", idempotencyKey: key.current });
          setPending(false);
          if (r.ok) {
            toast.success(r.data.replayed ? "Already posted" : "Adjustment posted");
            key.current = newKey();
            setV({ ...v, amount: "", reason: "", note: "" });
            router.refresh();
          } else toast.error(r.error);
          return r;
        }}
      />
    </div>
  );
}

export function ReconciliationRunner({ initial }: { initial: ReconCheck[] }) {
  const [checks, setChecks] = useState(initial);
  const [pending, setPending] = useState(false);
  const [ranAt, setRanAt] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const r = await runReconciliationAction();
            setPending(false);
            if (r.ok) {
              setChecks(r.data);
              setRanAt(new Date().toLocaleTimeString("en-MY"));
              toast.success(r.data.every((c) => c.ok) ? "All checks passed" : "Some checks failed");
            } else toast.error(r.error);
          }}
        >
          {pending && <Loader2 className="animate-spin" />}
          Run checks again
        </Button>
        {ranAt && <span className="text-xs text-muted-foreground">Last run {ranAt}</span>}
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-3 p-3 text-sm">
            <span className={c.ok ? "mt-0.5 size-2.5 shrink-0 rounded-full bg-emerald-500" : "mt-0.5 size-2.5 shrink-0 rounded-full bg-red-500"} aria-hidden />
            <div className="flex-1">
              <p className="font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
            </div>
            <span className={c.ok ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-red-700"}>{c.ok ? "PASS" : "FAIL"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
