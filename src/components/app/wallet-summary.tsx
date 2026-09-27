import { ArrowDownToLine, ArrowUpFromLine, Repeat } from "lucide-react";
import Link from "next/link";
import { formatCredits, formatMYR } from "@/lib/money";
import type { Balances } from "@/server/services/ledger";

function Action({ href, icon: Icon, label }: { href: string; icon: typeof Repeat; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 rounded-xl bg-white/12 px-2 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20">
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

/** Headline money position: Withdrawable first, then Cash, Credits and Pending Rewards. */
export function WalletSummary({ balances }: { balances: Balances }) {
  const pending = balances.PENDING_REWARDS;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,oklch(0.48_0.22_285),oklch(0.4_0.2_295))] p-5 text-white shadow-lift">
      <div aria-hidden className="absolute -top-16 -right-10 size-44 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-20 left-10 size-40 rounded-full bg-amber-300/15" />
      <Link href="/app/wallet" className="relative block">
        <p className="text-xs font-semibold tracking-wider text-white/70 uppercase">Withdrawable</p>
        <p className="font-heading text-4xl font-extrabold tabular">{formatMYR(balances.WITHDRAWABLE)}</p>
      </Link>
      <dl className="relative mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-[11px] text-white/65">Cash</dt>
          <dd className="font-semibold tabular">{formatMYR(balances.CASH)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-white/65">Credits</dt>
          <dd className="font-semibold tabular">{formatCredits(balances.CREDITS)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-white/65">Pending</dt>
          <dd className="font-semibold tabular">{formatMYR(pending)}</dd>
        </div>
      </dl>
      {balances.WITHDRAWAL_PENDING > 0n && (
        <p className="relative mt-2 text-xs text-white/75">{formatMYR(balances.WITHDRAWAL_PENDING)} withdrawal in progress</p>
      )}
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <Action href="/app/wallet/deposit" icon={ArrowDownToLine} label="Deposit" />
        <Action href="/app/wallet/convert" icon={Repeat} label="Convert" />
        <Action href="/app/wallet/withdraw" icon={ArrowUpFromLine} label="Withdraw" />
      </div>
    </div>
  );
}
