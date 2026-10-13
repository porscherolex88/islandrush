import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Banknote, ChevronRight, Clock, Coins, HeartHandshake, Landmark, LifeBuoy, ReceiptText, Repeat, Sparkles, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, Eyebrow, HeroCard, ListCard } from "@/components/app/kit";
import { MenuCard, MenuRow } from "@/components/app/menu-row";
import { Section } from "@/components/app/mobile-header";
import { DepositLevelCard } from "@/components/app/progression";
import { WalletHeader } from "@/components/app/root-page-header";
import { TransactionList } from "@/components/app/transaction-list";
import { WalletMoreSheet } from "@/components/app/wallet-more-sheet";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { formatCredits, formatCash, toDecimal } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/time";
import { ledgerActivity, pendingCashRewards } from "@/server/queries/wallet";
import { settleDueRewards } from "@/server/services/cash-rewards";
import { getConfig } from "@/server/services/config";
import { getRate } from "@/server/services/conversion";
import { depositLevelProgress } from "@/server/services/deposit-levels";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Wallet" };

const HOW_IT_WORKS = [
  { title: "Add money", body: "Deposit by bank transfer. Once approved, it becomes Cash." },
  { title: "Convert to Credits", body: "Credits open boxes and buy Market items. They can't be turned back into Cash." },
  { title: "Win rewards", body: "Cash rewards are reviewed for a short time before they can be withdrawn." },
  { title: "Withdraw", body: "Withdrawable money is sent to your own bank account." },
];

export default async function WalletPage() {
  const fiat = await getFiatDisplay();
  const user = await requireUser();
  await settleDueRewards({ userId: user.id, limit: 50 });
  const [b, activity, pending, rate, level, wcfg, rcfg] = await Promise.all([
    getBalances(user.id),
    ledgerActivity(user.id, { limit: 5 }),
    pendingCashRewards(user.id),
    getRate(),
    depositLevelProgress(user.id),
    getConfig("withdrawal"),
    getConfig("rewards"),
  ]);
  const cash = (value: string | bigint) => formatCash(value, { currency: fiat });
  const short = (value: string | bigint) => cash(value).replace(/\.00$/, "");

  const next =
    b.CASH > 0n
      ? { href: `/wallet/convert?amount=${toDecimal(b.CASH)}`, icon: Repeat, title: `Convert ${short(b.CASH)} to Credits`, body: "Your Cash is ready. Turn it into Credits to play." }
      : b.CREDITS === 0n && b.WITHDRAWABLE === 0n
        ? { href: "/wallet/deposit", icon: ArrowDownToLine, title: "Add money to start", body: "Deposit by bank transfer, then convert it into Credits." }
        : b.WITHDRAWABLE > 0n
          ? { href: "/wallet/withdraw", icon: ArrowUpFromLine, title: `Withdraw ${short(b.WITHDRAWABLE)}`, body: "Send your rewards to your bank account." }
          : null;

  const onTheWay = pending.length > 0 || b.WITHDRAWAL_PENDING > 0n;

  return (
    <div className="pb-4">
      <WalletHeader />

      <Section className="pt-1">
        <HeroCard>
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <Eyebrow className="flex items-center gap-1 text-white/70">
                <Coins className="size-3.5 text-amber-200" aria-hidden /> Credits
              </Eyebrow>
              <p className="mt-1 truncate font-heading text-3xl font-extrabold tabular">{formatCredits(b.CREDITS)}</p>
              <p className="text-xs text-white/65">To play</p>
            </div>
            <div className="min-w-0">
              <Eyebrow className="flex items-center gap-1 text-white/70">
                <Landmark className="size-3.5 text-emerald-300" aria-hidden /> Withdrawable
              </Eyebrow>
              <p className="mt-1 truncate font-heading text-3xl font-extrabold tabular">{short(b.WITHDRAWABLE)}</p>
              <p className="text-xs text-white/65">To your bank</p>
            </div>
          </div>
          <div className="mt-4 flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-white/10 px-3.5 py-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="text-white/70">Cash </span>
              <strong className="tabular">{cash(b.CASH)}</strong>
            </span>
            {b.CASH > 0n ? (
              <Link href={`/wallet/convert?amount=${toDecimal(b.CASH)}`} className="inline-flex shrink-0 items-center gap-1 font-bold text-amber-200">
                Convert <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className="shrink-0 text-xs text-white/60 tabular">
                {short(rate.cash)} = {formatCredits(rate.creditsNumber)} Credits
              </span>
            )}
          </div>
        </HeroCard>

        <nav aria-label="Wallet actions" className="mt-4 grid grid-cols-4 gap-2">
          <ActionButton href="/wallet/deposit" label="Add money" icon={ArrowDownToLine} primary />
          <ActionButton href="/wallet/convert" label="Convert" icon={Repeat} />
          <ActionButton href="/wallet/withdraw" label="Withdraw" icon={ArrowUpFromLine} />
          <WalletMoreSheet openOnHash="deposit-level">
            <details id="deposit-level" className="group rounded-3xl border bg-card">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span
                  className="size-10 shrink-0 rounded-2xl ring-4 ring-white"
                  style={{ background: `linear-gradient(135deg, ${level.current?.color ?? "#94a3b8"}, color-mix(in oklch, ${level.current?.color ?? "#94a3b8"}, black 25%))` }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-muted-foreground">Deposit Level</span>
                  <span className="block font-heading text-lg leading-tight font-extrabold">{level.current?.name ?? "Starter"}</span>
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                  <TrendingUp className="size-4" aria-hidden />
                  <span className="group-open:hidden">Details</span>
                  <span className="hidden group-open:inline">Hide</span>
                </span>
              </summary>
              <div className="border-t p-3">
                <DepositLevelCard {...level} platformMaxDaily={wcfg.maxDaily} fiat={fiat} />
              </div>
            </details>

            <div>
              <h2 className="mb-2 font-heading text-lg font-bold">Manage</h2>
              <MenuCard>
                <MenuRow href="/wallet/transactions" icon={ReceiptText} label="All transactions" />
                <MenuRow href="/account/withdrawal-accounts" icon={Landmark} label="Bank accounts" />
                <MenuRow href="/account/responsible-play" icon={HeartHandshake} label="Deposit and play limits" />
                <MenuRow href="/account/support" icon={LifeBuoy} label="Get help with a payment" />
              </MenuCard>
            </div>

            <details className="group rounded-3xl border bg-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
                <Sparkles className="size-4 text-gold" aria-hidden />
                <span className="flex-1">How money works</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
              </summary>
              <ol className="space-y-3 border-t p-4">
                {HOW_IT_WORKS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full font-heading text-sm font-extrabold", i === 3 ? "bg-success-soft text-success" : "bg-brand-soft text-primary")}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{s.title}</span>
                      <span className="block text-sm text-muted-foreground">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="border-t px-4 py-3 text-xs text-muted-foreground">Every change to your balance is recorded in your transaction history.</p>
            </details>
          </WalletMoreSheet>
        </nav>
      </Section>

      {next && (
        <Section className="py-1">
          <Link href={next.href} className="flex min-h-16 items-center gap-3 rounded-3xl border border-gold/40 bg-gold-soft p-3.5 transition-colors hover:bg-amber-100/70">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-gold-foreground">
              <next.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{next.title}</span>
              <span className="block text-xs text-gold-foreground">{next.body}</span>
            </span>
            <ChevronRight className="size-5 text-gold-foreground" aria-hidden />
          </Link>
        </Section>
      )}

      {onTheWay && (
        <Section title="On the way" action={<span className="text-xs font-semibold text-muted-foreground">Rewards take about {rcfg.pendingHours} hours</span>}>
          <ListCard className="divide-y">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3.5 text-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-foreground" aria-hidden>
                  <Clock className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.referralLevel ? `Invite reward (level ${r.referralLevel})` : "Game reward"}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.status === "HELD" ? "Under review" : `Withdrawable after ${formatDateTime(r.settleAfter)}`}</p>
                </div>
                <p className="shrink-0 font-semibold tabular">{cash(r.amount)}</p>
              </div>
            ))}
            {b.WITHDRAWAL_PENDING > 0n && (
              <Link href="/wallet/withdraw" className="flex items-center gap-3 p-3.5 text-sm hover:bg-surface">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-primary" aria-hidden>
                  <ArrowUpFromLine className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Withdrawal in progress</p>
                  <p className="text-xs text-muted-foreground">On its way to your bank</p>
                </div>
                <p className="shrink-0 font-semibold tabular">{cash(b.WITHDRAWAL_PENDING)}</p>
              </Link>
            )}
          </ListCard>
        </Section>
      )}

      <Section
        title="Recent activity"
        action={
          <Link href="/wallet/transactions" className="flex h-11 items-center text-sm font-semibold text-primary">
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
    </div>
  );
}
