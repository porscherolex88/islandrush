import { AlertCircle, ArrowUpFromLine, Landmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Panel, Section } from "@/components/app/mobile-header";
import { CancelWithdrawalButton, WithdrawForm } from "@/components/app/withdraw-form";
import { maskAccount } from "@/lib/format";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatMYR, toDecimal } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { settleDueRewards } from "@/server/services/cash-rewards";
import { isFeatureEnabled } from "@/server/services/config";
import { getWithdrawalEligibility, userWithdrawalAccounts, userWithdrawals } from "@/server/services/withdrawals";

export const metadata: Metadata = { title: "Withdraw" };

const STEPS = ["PENDING", "REVIEW", "APPROVED", "PROCESSING", "COMPLETED"];

export default async function WithdrawPage() {
  const user = await requireUser();
  await settleDueRewards({ userId: user.id, limit: 50 });
  const [elig, accounts, history, enabled] = await Promise.all([
    getWithdrawalEligibility(user.id),
    userWithdrawalAccounts(user.id),
    userWithdrawals(user.id, 15),
    isFeatureEnabled("withdrawals"),
  ]);

  return (
    <div>
      <InnerPageHeader title="Withdraw" subtitle="To your bank account" icon={<ArrowUpFromLine />} />
      <Section>
        <Panel className="bg-success-soft/60">
          <p className="text-sm text-muted-foreground">Withdrawable balance</p>
          <p className="font-heading text-3xl font-bold tabular">{formatMYR(elig.available)}</p>
          <Link href="/app/wallet#deposit-level" className="mt-1 inline-flex h-11 items-center text-sm font-semibold text-primary">
            Your daily limit depends on your Deposit Level
          </Link>
        </Panel>
      </Section>
      <Section>
        {!enabled ? (
          <EmptyState icon={<Landmark className="size-8 text-primary" />} title="Withdrawals are paused" description="We are doing some maintenance. Your balance is safe." />
        ) : !elig.eligible ? (
          <div className="space-y-2 rounded-2xl border border-warning/40 bg-warning-soft p-4">
            <p className="flex items-center gap-2 font-semibold">
              <AlertCircle className="size-4 text-warning" aria-hidden /> You cannot withdraw yet
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {elig.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {elig.requiresReview && <p className="mb-3 rounded-xl bg-brand-soft p-3 text-sm text-primary">This withdrawal will get an extra security review before payout.</p>}
            <WithdrawForm
              accounts={accounts.map((a) => ({ id: a.id, bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, isDefault: a.isDefault }))}
              available={toDecimal(elig.available)}
              min={toDecimal(elig.min)}
              max={toDecimal(elig.max)}
            />
          </>
        )}
      </Section>
      {history.length > 0 && (
        <Section title="Your withdrawals">
          <ul className="space-y-2">
            {history.map((w) => {
              const step = STEPS.indexOf(w.status);
              return (
                <li key={w.id} className="rounded-2xl border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold tabular">{formatMYR(w.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(w.createdAt)} · {w.accountSnapshot.bankName} {maskAccount(w.accountSnapshot.accountNumber)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {w.status === "PENDING" && <CancelWithdrawalButton id={w.id} />}
                      <StatusBadge status={w.status} />
                    </div>
                  </div>
                  {step >= 0 && (
                    <ol className="mt-3 flex gap-1" aria-label="Withdrawal progress">
                      {STEPS.map((s, i) => (
                        <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} title={s} />
                      ))}
                    </ol>
                  )}
                  {(w.status === "REJECTED" || w.status === "CANCELLED") && w.reviewNote && <p className="mt-2 text-xs text-muted-foreground">{w.reviewNote}</p>}
                  {w.status === "COMPLETED" && w.payoutReference && <p className="mt-2 text-xs text-muted-foreground">Payout reference: {w.payoutReference}</p>}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
