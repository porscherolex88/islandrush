import { Check, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatMYR, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

export function XPProgress({ level, title, total, pct, toNext, nextTitle }: { level: number; title: string; total: number; pct: number; toNext: number; nextTitle: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_80%_0%,oklch(0.45_0.08_205),oklch(0.26_0.05_225)_70%)] p-5 text-white shadow-lift">
      <div className="flex items-center gap-4">
        <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.72_0.16_65))] font-heading text-3xl font-extrabold text-amber-950 shadow-lift">
          {level}
          <span className="absolute -bottom-2 rounded-full bg-white px-2 text-[10px] font-bold tracking-wide text-amber-800 uppercase shadow">Level</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-2xl leading-tight font-extrabold">
            Level {level} - {title}
          </p>
          <p className="text-sm font-semibold text-white/80 tabular">{total.toLocaleString("en-MY")} XP</p>
        </div>
      </div>
      <Progress value={pct} className="mt-5 h-3 bg-white/15" indicatorClassName="bg-[linear-gradient(90deg,#fde68a,#f59e0b)]" aria-label="Progress to next level" />
      <p className="mt-2 text-sm text-white/85">
        {nextTitle ? (
          <>
            <strong className="text-white">{toNext.toLocaleString("en-MY")} XP</strong> to {nextTitle}
          </>
        ) : (
          "Maximum level reached"
        )}
      </p>
      <p className="mt-2 text-xs text-white/60">XP (experience points) comes from playing, missions and your streak. It shows how far you have explored.</p>
    </div>
  );
}

type Level = { id: string; name: string; sortOrder: number; threshold: string; color: string; benefits: string[]; canWithdraw: boolean; withdrawalMaxDaily: string | null };

/**
 * Deposit Level with its money consequence spelled out: the level comes from total
 * qualifying deposits, and each level sets the daily withdrawal limit.
 */
export function DepositLevelCard({ current, next, levels, total, pct, toNext, platformMaxDaily }: { current: Level | null; next: Level | null; levels: Level[]; total: string; pct: number; toNext: bigint; platformMaxDaily: string }) {
  const limitFor = (l: Level | null) => {
    if (l && !l.canWithdraw) return null;
    const cap = toMinor(platformMaxDaily);
    const lvl = l?.withdrawalMaxDaily ? toMinor(l.withdrawalMaxDaily) : cap;
    return lvl < cap ? lvl : cap;
  };
  const currentLimit = limitFor(current);
  const nextLimit = limitFor(next);
  return (
    <div className="rounded-3xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="size-12 shrink-0 rounded-2xl shadow-card ring-4 ring-white" style={{ background: `linear-gradient(135deg, ${current?.color ?? "#94a3b8"}, color-mix(in oklch, ${current?.color ?? "#94a3b8"}, black 25%))` }} aria-hidden />
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground">Deposit Level</p>
          <p className="font-heading text-xl font-extrabold">{current?.name ?? "Starter"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-muted-foreground">Daily withdrawal limit</p>
          <p className="font-heading text-xl font-extrabold tabular">{currentLimit === null ? "Not yet" : formatMYR(currentLimit)}</p>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-surface p-3 text-sm">
        Your level is based on your <strong>total qualifying deposits</strong>: every approved deposit, added up over time. A higher level means a <strong>higher daily withdrawal limit</strong>.
      </p>
      <p className="mt-3 text-sm">
        Total qualifying deposits: <strong className="tabular">{formatMYR(total)}</strong>
      </p>
      {next && (
        <>
          <Progress value={pct} className="mt-2 h-2.5" indicatorClassName="bg-amber-500" aria-label="Progress to next Deposit Level" />
          <p className="mt-1.5 text-sm text-muted-foreground">
            <strong className="text-foreground">{formatMYR(toNext)}</strong> more in qualifying deposits to reach {next.name}
            {nextLimit !== null && nextLimit !== currentLimit && <> (daily limit {formatMYR(nextLimit)})</>}.
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
                  <span className="block text-xs text-muted-foreground">From {formatMYR(l.threshold)} total deposits</span>
                </span>
                <span className="text-right text-xs">
                  <span className="block text-muted-foreground">Daily limit</span>
                  <strong className="tabular">{limit === null ? "No withdrawals" : formatMYR(limit)}</strong>
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
