import { Check, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { FiatDisplay } from "@/lib/fiat-display.shared";
import { formatCash, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

type Level = { id: string; name: string; sortOrder: number; threshold: string; color: string; benefits: string[]; canWithdraw: boolean; withdrawalMaxDaily: string | null };

/**
 * Deposit Level with its money consequence spelled out: the level comes from total
 * qualifying deposits, and each level sets the daily withdrawal limit.
 */
export function DepositLevelCard({
  current,
  next,
  levels,
  total,
  pct,
  toNext,
  platformMaxDaily,
  fiat,
}: {
  current: Level | null;
  next: Level | null;
  levels: Level[];
  total: string;
  pct: number;
  toNext: bigint;
  platformMaxDaily: string;
  fiat: FiatDisplay;
}) {
  const limitFor = (l: Level | null) => {
    if (l && !l.canWithdraw) return null;
    const cap = toMinor(platformMaxDaily);
    const lvl = l?.withdrawalMaxDaily ? toMinor(l.withdrawalMaxDaily) : cap;
    return lvl < cap ? lvl : cap;
  };
  const currentLimit = limitFor(current);
  const nextLimit = limitFor(next);
  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="size-12 shrink-0 rounded-2xl ring-4 ring-white" style={{ background: `linear-gradient(135deg, ${current?.color ?? "#94a3b8"}, color-mix(in oklch, ${current?.color ?? "#94a3b8"}, black 25%))` }} aria-hidden />
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground">Deposit Level</p>
          <p className="font-heading text-xl font-extrabold">{current?.name ?? "Starter"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-muted-foreground">Daily withdrawal limit</p>
          <p className="font-heading text-xl font-extrabold tabular">{currentLimit === null ? "Not yet" : formatCash(currentLimit, { currency: fiat })}</p>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-surface p-3 text-sm">
        Your level is based on your <strong>total qualifying deposits</strong>: every approved deposit, added up over time. A higher level means a <strong>higher daily withdrawal limit</strong>.
      </p>
      <p className="mt-3 text-sm">
        Total qualifying deposits: <strong className="tabular">{formatCash(total, { currency: fiat })}</strong>
      </p>
      {next && (
        <>
          <Progress value={pct} className="mt-2 h-2.5" indicatorClassName="bg-amber-500" aria-label="Progress to next Deposit Level" />
          <p className="mt-1.5 text-sm text-muted-foreground">
            <strong className="text-foreground">{formatCash(toNext, { currency: fiat })}</strong> more in qualifying deposits to reach {next.name}
            {nextLimit !== null && nextLimit !== currentLimit && <> (daily limit {formatCash(nextLimit, { currency: fiat })})</>}.
          </p>
        </>
      )}
      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">See every level and its limit</summary>
        <ol className="mt-1 space-y-1.5">
          {levels.map((l) => {
            const reached = current && l.sortOrder <= current.sortOrder;
            const limit = limitFor(l);
            return (
              <li key={l.id} className={cn("flex items-center gap-2 rounded-xl p-2.5 text-sm", current?.id === l.id ? "bg-brand-soft" : "bg-surface")}>
                <span className="size-3 rounded-full" style={{ background: l.color }} aria-hidden />
                <span className="flex-1">
                  <span className="font-semibold">{l.name}</span>
                  <span className="block text-xs text-muted-foreground">From {formatCash(l.threshold, { currency: fiat })} total deposits</span>
                </span>
                <span className="text-right text-xs">
                  <span className="block text-muted-foreground">Daily limit</span>
                  <strong className="tabular">{limit === null ? "No withdrawals" : formatCash(limit, { currency: fiat })}</strong>
                </span>
                {reached ? <Check className="size-4 text-success" aria-label="Reached" /> : <Lock className="size-3.5 text-muted-foreground" aria-label="Not reached" />}
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
