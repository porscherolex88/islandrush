import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Banknote, Clock, Coins, History, Info, Landmark, Repeat, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { headerPillButton } from "@/components/app/header-buttons";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { DepositLevelCard } from "@/components/app/progression";
import { TransactionList } from "@/components/app/transaction-list";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime } from "@/lib/time";
import { ledgerActivity, pendingCashRewards } from "@/server/queries/wallet";
import { settleDueRewards } from "@/server/services/cash-rewards";
import { getConfig } from "@/server/services/config";
import { getRate } from "@/server/services/conversion";
import { depositLevelProgress } from "@/server/services/deposit-levels";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Wallet" };

const FLOW = ["Deposit", "Cash", "Credits", "Play", "Reward", "Pending", "Withdrawable"];

function MoneyRow({ icon, label, meaning, value, tone }: { icon: ReactNode; label: string; meaning: string; value: string; tone: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3.5">
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${tone}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted-foreground">{meaning}</p>
      </div>
      <p className="font-heading text-lg font-bold tabular">{value}</p>
    </div>
  );
}

export default async function WalletPage() {
  const fiat = await getFiatDisplay();
  const user = await requireUser();
  await settleDueRewards({ userId: user.id, limit: 50 });
  const [b, activity, pending, rate, level, wcfg, rcfg] = await Promise.all([
    getBalances(user.id),
    ledgerActivity(user.id, { limit: 6 }),
    pendingCashRewards(user.id),
    getRate(),
    depositLevelProgress(user.id),
    getConfig("withdrawal"),
    getConfig("rewards"),
  ]);
  const rateText = `${formatCash(rate.cash, { currency: fiat }).replace(/\.00$/, "")} = ${formatCredits(rate.creditsNumber)} Credits`;

  return (
    <div>
      <InnerPageHeader
        title="Wallet"
        action={
          <Link href="/app/wallet/transactions" className={headerPillButton}>
            <History className="size-4" aria-hidden /> History
          </Link>
        }
      />
      <Section>
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_0%,oklch(0.52_0.1_200),oklch(0.33_0.07_222)_75%)] p-5 text-white">
          <div aria-hidden className="absolute -top-16 -right-10 size-44 rounded-full bg-white/10" />
          <p className="relative text-sm font-semibold text-white/80">Withdrawable</p>
          <p className="relative font-heading text-4xl font-extrabold tabular">{formatCash(b.WITHDRAWABLE, { currency: fiat })}</p>
          <p className="relative text-sm text-white/75">Available to withdraw to your bank</p>
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {[
              { href: "/app/wallet/deposit", label: "Deposit", icon: ArrowDownToLine },
              { href: "/app/wallet/convert", label: "Convert", icon: Repeat },
              { href: "/app/wallet/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/15 text-sm font-semibold hover:bg-white/25">
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Your money">
        <div className="space-y-2">
          <MoneyRow icon={<Wallet className="size-5" />} tone="bg-brand-soft text-primary" label="Cash" meaning="Available to convert into Credits" value={formatCash(b.CASH, { currency: fiat })} />
          <MoneyRow icon={<Coins className="size-5" />} tone="bg-gold-soft text-gold-foreground" label="Credits" meaning={`Used to play. ${rateText}`} value={formatCredits(b.CREDITS)} />
          <MoneyRow icon={<Clock className="size-5" />} tone="bg-surface text-muted-foreground" label="Pending" meaning={`Rewards under review, usually about ${rcfg.pendingHours} hours`} value={formatCash(b.PENDING_REWARDS, { currency: fiat })} />
          {b.WITHDRAWAL_PENDING > 0n && (
            <MoneyRow icon={<Landmark className="size-5" />} tone="bg-surface text-muted-foreground" label="Withdrawal in progress" meaning="Being sent to your bank" value={formatCash(b.WITHDRAWAL_PENDING, { currency: fiat })} />
          )}
        </div>
      </Section>

      <Section title="How it works">
        <div className="rounded-2xl border bg-card p-4">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="How money moves in LootBox">
            {FLOW.map((step, i) => (
              <li key={step} className="flex items-center gap-1">
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${step === "Withdrawable" ? "bg-success-soft text-success" : step === "Credits" ? "bg-gold-soft text-gold-foreground" : "bg-surface"}`}>{step}</span>
                {i < FLOW.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />}
              </li>
            ))}
          </ol>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>1. Your approved deposit becomes Cash.</li>
            <li>2. Convert Cash into Credits to play. Credits cannot be turned back into Cash.</li>
            <li>3. Cash rewards you win wait in Pending for a short review.</li>
            <li>4. After review they become Withdrawable, and you can send them to your bank.</li>
          </ul>
        </div>
      </Section>

      {pending.length > 0 && (
        <Section title="Pending rewards">
          <ul className="divide-y rounded-2xl border bg-card">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-3.5 text-sm">
                <div>
                  <p className="font-semibold">{r.referralLevel ? `Invite reward (level ${r.referralLevel})` : "Game reward"}</p>
                  <p className="text-xs text-muted-foreground">{r.status === "HELD" ? "Under review" : `Withdrawable after ${formatDateTime(r.settleAfter)}`}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular">{formatCash(r.amount, { currency: fiat })}</p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Deposit Level">
        <div id="deposit-level" className="scroll-mt-20">
          <DepositLevelCard {...level} platformMaxDaily={wcfg.maxDaily} fiat={fiat} />
        </div>
      </Section>

      <Section
        title="Recent activity"
        action={
          <Link href="/app/wallet/transactions" className="flex h-11 items-center text-sm font-semibold text-primary">
            See all
          </Link>
        }
      >
        {activity.rows.length ? (
          <TransactionList rows={activity.rows} fiat={fiat} />
        ) : (
          <EmptyState icon={<Banknote className="size-8 text-primary" />} title="No activity yet" description="Deposits, conversions, games and rewards will appear here." />
        )}
      </Section>
      <Section>
        <p className="flex gap-2 rounded-xl bg-surface p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Every change to your balance is recorded. If something looks wrong, contact support from your Account page.
        </p>
      </Section>
    </div>
  );
}
