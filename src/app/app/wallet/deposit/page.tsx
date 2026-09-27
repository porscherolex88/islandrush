import { ArrowDownToLine, Landmark, Lock } from "lucide-react";
import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { deposits as depositsTable } from "@/db/schema";
import { DepositForm } from "@/components/app/deposit-form";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { getConfig, isFeatureEnabled } from "@/server/services/config";
import { listPaymentAccounts, userDeposits } from "@/server/services/deposits";

export const metadata: Metadata = { title: "Deposit" };

export default async function DepositPage() {
  const user = await requireUser();
  const [accounts, cfg, deposits, enabled, [{ n }]] = await Promise.all([
    listPaymentAccounts(),
    getConfig("deposit"),
    userDeposits(user.id, 10),
    isFeatureEnabled("deposits"),
    db.select({ n: count() }).from(depositsTable).where(eq(depositsTable.userId, user.id)),
  ]);
  const reference = `LB-${user.referralCode}-${String(n + 1).padStart(3, "0")}`;

  return (
    <div>
      <InnerPageHeader title="Deposit" subtitle="Add money by bank transfer" icon={<ArrowDownToLine />} />
      <Section>
        {!enabled ? (
          <EmptyState icon={<Landmark className="size-8 text-primary" />} title="Deposits are paused" description="We are doing some maintenance. Please try again later." />
        ) : user.status !== "ACTIVE" ? (
          <EmptyState icon={<Lock className="size-8 text-primary" />} title="Deposits unavailable" description="Your account is suspended. Please contact support." />
        ) : (
          <DepositForm
            accounts={accounts.map((a) => ({ id: a.id, bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, instructions: a.instructions }))}
            methods={cfg.methods}
            min={cfg.min}
            max={cfg.max}
            proofRequired={cfg.proofRequired}
            defaultName={user.name}
            reference={reference}
          />
        )}
      </Section>
      {deposits.length > 0 && (
        <Section title="Your deposits">
          <ul className="divide-y rounded-2xl border bg-card">
            {deposits.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold tabular">{formatMYR(d.amount)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(d.createdAt)} · Ref {d.reference}
                  </p>
                  {d.status === "REJECTED" && d.reviewNote && <p className="text-xs text-destructive">{d.reviewNote}</p>}
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
