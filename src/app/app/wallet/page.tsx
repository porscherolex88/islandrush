import { ArrowDownToLine, ArrowUpFromLine, Info, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { TransactionList } from "@/components/app/transaction-list";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatCredits, formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { ledgerActivity, pendingCashRewards } from "@/server/queries/wallet";
import { settleDueRewards } from "@/server/services/cash-rewards";
import { getRate } from "@/server/services/conversion";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Wallet" };

export default async function WalletPage() {
  const user = await requireUser();
  await settleDueRewards({ userId: user.id, limit: 50 });
  const [b, activity, pending, rate] = await Promise.all([getBalances(user.id), ledgerActivity(user.id, { limit: 6 }), pendingCashRewards(user.id), getRate()]);

  const accounts = [
    { key: "WITHDRAWABLE", label: "Withdrawable", value: formatMYR(b.WITHDRAWABLE), hint: "Settled cash you can withdraw to your bank.", tone: "bg-success-soft" },
    { key: "CASH", label: "Cash Wallet", value: formatMYR(b.CASH), hint: "Approved deposits. Convert to Credits to play.", tone: "bg-brand-soft" },
    { key: "CREDITS", label: "Credits", value: formatCredits(b.CREDITS), hint: `Used to play games. RM${rate.cash.replace(/\.00$/, "")} = ${formatCredits(rate.creditsNumber)} Credits.`, tone: "bg-gold-soft" },
    { key: "PENDING_REWARDS", label: "Pending Rewards", value: formatMYR(b.PENDING_REWARDS), hint: "Cash rewards that become Withdrawable after a short review period.", tone: "bg-surface" },
  ];

  return (
    <div>
      <PageHeader title="Wallet" back="/app" action={<Link href="/app/wallet/transactions" className="pt-2 text-sm font-semibold text-primary">History</Link>} />
      <Section>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/app/wallet/deposit", label: "Deposit", icon: ArrowDownToLine },
            { href: "/app/wallet/convert", label: "Convert", icon: Repeat },
            { href: "/app/wallet/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card py-3 text-sm font-semibold hover:bg-surface">
              <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </Section>
      <Section>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.key} className={`rounded-2xl p-4 ${a.tone}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="font-heading text-2xl font-bold tabular">{a.value}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.hint}</p>
            </div>
          ))}
          {b.WITHDRAWAL_PENDING > 0n && (
            <div className="flex items-center justify-between rounded-2xl border p-4">
              <p className="text-sm font-semibold">Withdrawals in progress</p>
              <p className="font-heading text-lg font-bold tabular">{formatMYR(b.WITHDRAWAL_PENDING)}</p>
            </div>
          )}
        </div>
      </Section>

      {pending.length > 0 && (
        <Section title="Pending rewards">
          <ul className="divide-y rounded-2xl border bg-card">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium">{r.referralLevel ? `Referral reward (L${r.referralLevel})` : "Game reward"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.status === "HELD" ? "Under review" : `Available after ${formatDateTime(r.settleAfter)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular">{formatMYR(r.amount)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recent activity" action={<Link href="/app/wallet/transactions" className="text-xs font-semibold text-primary">See all</Link>}>
        {activity.rows.length ? (
          <TransactionList rows={activity.rows} />
        ) : (
          <EmptyState icon="💳" title="No activity yet" description="Deposits, conversions, game spends and rewards will appear here." />
        )}
      </Section>
      <Section>
        <p className="flex gap-2 rounded-xl bg-surface p-3 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden />
          Every balance change is recorded in an append-only ledger. If something looks wrong, contact support from your Account page.
        </p>
      </Section>
    </div>
  );
}
