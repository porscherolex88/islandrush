import { formatCredits, formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ActivityRow } from "@/server/queries/wallet";

const ACCOUNT_LABEL: Record<string, string> = {
  CASH: "Cash",
  CREDITS: "Credits",
  PENDING_REWARDS: "Pending",
  WITHDRAWABLE: "Withdrawable",
  WITHDRAWAL_PENDING: "Withdrawal in progress",
};

const TYPE_ICON: Record<string, string> = {
  DEPOSIT: "⬇️",
  DEPOSIT_REVERSAL: "↩️",
  CONVERSION: "🔁",
  GAME_SPEND: "🎲",
  GAME_REWARD_CREDITS: "🎁",
  CASH_REWARD: "💵",
  REFERRAL_REWARD: "🤝",
  SETTLEMENT: "✅",
  REWARD_REVERSAL: "↩️",
  WITHDRAWAL_REQUEST: "⬆️",
  WITHDRAWAL_COMPLETE: "🏦",
  WITHDRAWAL_RETURN: "↩️",
  ADJUSTMENT: "🛠️",
};

function amountText(currency: "MYR" | "CREDITS", amount: string) {
  return currency === "MYR" ? formatMYR(amount, { sign: true }) : `${formatCredits(amount, { sign: true })} Credits`;
}

export function TransactionList({ rows }: { rows: ActivityRow[] }) {
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-3 p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-lg" aria-hidden>
            {TYPE_ICON[r.type] ?? "•"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{r.description}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
          </div>
          <div className="shrink-0 text-right">
            {r.entries.map((e, i) => (
              <p key={i} className={cn("text-sm font-semibold tabular", e.amount.startsWith("-") ? "text-foreground" : "text-success")}>
                {amountText(e.currency, e.amount)}
                <span className="block text-[10px] font-medium text-muted-foreground">{ACCOUNT_LABEL[e.account] ?? e.account}</span>
              </p>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
