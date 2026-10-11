import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Banknote, Dices, Gift, Landmark, type LucideIcon, Repeat, Undo2, Users, Wrench } from "lucide-react";
import type { FiatDisplay } from "@/lib/fiat-display.shared";
import { formatCash, formatCredits } from "@/lib/money";
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

const TYPE: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  DEPOSIT: { icon: ArrowDownToLine, label: "Deposit approved", tone: "bg-success-soft text-success" },
  DEPOSIT_REVERSAL: { icon: Undo2, label: "Deposit reversed", tone: "bg-surface text-muted-foreground" },
  CONVERSION: { icon: Repeat, label: "Cash converted to Credits", tone: "bg-gold-soft text-gold-foreground" },
  GAME_SPEND: { icon: Dices, label: "Played a game", tone: "bg-brand-soft text-primary" },
  GAME_REWARD_CREDITS: { icon: Gift, label: "Credits reward", tone: "bg-gold-soft text-gold-foreground" },
  CASH_REWARD: { icon: Banknote, label: "Cash reward", tone: "bg-success-soft text-success" },
  REFERRAL_REWARD: { icon: Users, label: "Invite reward", tone: "bg-success-soft text-success" },
  SETTLEMENT: { icon: BadgeCheck, label: "Reward now withdrawable", tone: "bg-success-soft text-success" },
  REWARD_REVERSAL: { icon: Undo2, label: "Reward reversed", tone: "bg-surface text-muted-foreground" },
  WITHDRAWAL_REQUEST: { icon: ArrowUpFromLine, label: "Withdrawal requested", tone: "bg-brand-soft text-primary" },
  WITHDRAWAL_COMPLETE: { icon: Landmark, label: "Withdrawal paid to bank", tone: "bg-success-soft text-success" },
  WITHDRAWAL_RETURN: { icon: Undo2, label: "Withdrawal returned", tone: "bg-surface text-muted-foreground" },
  ADJUSTMENT: { icon: Wrench, label: "Balance adjustment", tone: "bg-surface text-muted-foreground" },
};

const HIDE_DETAIL = new Set(["DEPOSIT", "SETTLEMENT", "CONVERSION"]);

/** Ledger descriptions are immutable; internal codes and test markers are stripped only for display. */
function sanitize(description: string) {
  return description
    .replace(/\s*\((?:demo|test|seed)\)/gi, "")
    .replace(/\s*\((?:[A-Z]+(?:_[A-Z]+)*|[a-z]+(?:_[a-z]+)+)\)$/, "")
    .trim();
}

function detail(type: string, description: string, label: string) {
  if (HIDE_DETAIL.has(type)) return null;
  const clean = sanitize(description);
  // A description that only restates the amount ("RM100.00 Cash Reward", "2,000 Credits") duplicates the amount column, possibly in another currency.
  if (/^(RM\s?[\d,.]+|[\d,]+ Credits)( Cash Reward)?$/i.test(clean)) return null;
  return clean && clean !== label ? clean : null;
}

function amountText(currency: "MYR" | "CREDITS", amount: string, fiat: FiatDisplay) {
  return currency === "MYR" ? formatCash(amount, { currency: fiat, sign: true }) : `${formatCredits(amount, { sign: true })} Credits`;
}

export function TransactionList({ rows, fiat }: { rows: ActivityRow[]; fiat: FiatDisplay }) {
  return (
    <ul className="divide-y rounded-3xl border bg-card">
      {rows.map((r) => {
        const t = TYPE[r.type] ?? { icon: Banknote, label: sanitize(r.description), tone: "bg-surface text-muted-foreground" };
        const Icon = t.icon;
        const sub = detail(r.type, r.description, t.label);
        return (
          <li key={r.id} className="flex gap-3 p-3.5">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", t.tone)} aria-hidden>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.label}</p>
              {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
              <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
            </div>
            <div className="shrink-0 text-right">
              {r.entries.map((e, i) => (
                <p key={i} className={cn("text-sm font-semibold tabular", e.amount.startsWith("-") ? "text-foreground" : "text-success")}>
                  {amountText(e.currency, e.amount, fiat)}
                  <span className="block text-[11px] font-medium text-muted-foreground">{ACCOUNT_LABEL[e.account] ?? e.account}</span>
                </p>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
