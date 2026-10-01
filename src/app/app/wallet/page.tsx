import { ArrowRight, Banknote, HeartHandshake, Info, Landmark, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MenuCard, MenuRow } from "@/components/app/menu-row";
import { Section } from "@/components/app/mobile-header";
import { DepositLevelCard } from "@/components/app/progression";
import { WalletHeader } from "@/components/app/root-page-header";
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
  const cash = (value: string | bigint) => formatCash(value, { currency: fiat });

  return (
    <div>
      <WalletHeader
        withdrawable={cash(b.WITHDRAWABLE)}
        cash={cash(b.CASH)}
        credits={formatCredits(b.CREDITS)}
        rate={`${cash(rate.cash).replace(/\.00$/, "")} = ${formatCredits(rate.creditsNumber)} Credits. Credits are used to play and cannot be turned back into Cash.`}
        pending={b.PENDING_REWARDS > 0n ? cash(b.PENDING_REWARDS) : null}
        outgoing={b.WITHDRAWAL_PENDING > 0n ? cash(b.WITHDRAWAL_PENDING) : null}
      />

      {pending.length > 0 && (
        <Section title="Rewards under review" action={<span className="text-xs font-semibold text-muted-foreground">About {rcfg.pendingHours} hours</span>}>
          <ul className="divide-y rounded-2xl border bg-card">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-3.5 text-sm">
                <div>
                  <p className="font-semibold">{r.referralLevel ? `Invite reward (level ${r.referralLevel})` : "Game reward"}</p>
                  <p className="text-xs text-muted-foreground">{r.status === "HELD" ? "Under review" : `Withdrawable after ${formatDateTime(r.settleAfter)}`}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular">{cash(r.amount)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

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

      <Section title="Deposit Level">
        <div id="deposit-level" className="scroll-mt-20">
          <DepositLevelCard {...level} platformMaxDaily={wcfg.maxDaily} fiat={fiat} />
        </div>
      </Section>

      <Section title="Manage">
        <MenuCard>
          <MenuRow href="/app/wallet/transactions" icon={ReceiptText} label="All transactions" />
          <MenuRow href="/app/account/withdrawal-accounts" icon={Landmark} label="Bank accounts" />
          <MenuRow href="/app/account/responsible-play" icon={HeartHandshake} label="Deposit and play limits" />
        </MenuCard>
      </Section>

      <Section>
        <details className="group rounded-2xl border bg-card">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-2 px-4 font-semibold">
            How money moves in LootBox
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <div className="border-t p-4">
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
        </details>
      </Section>

      <Section>
        <p className="flex gap-2 rounded-xl bg-surface p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Every change to your balance is recorded. If something looks wrong,{" "}
            <Link href="/app/account/support" className="font-semibold text-primary underline-offset-2 hover:underline">
              contact support
            </Link>
            .
          </span>
        </p>
      </Section>
    </div>
  );
}
