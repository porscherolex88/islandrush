import { Check, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatMYR } from "@/lib/money";
import { cn } from "@/lib/utils";

export function XPProgress({
  level,
  title,
  total,
  pct,
  toNext,
  nextTitle,
}: {
  level: number;
  title: string;
  total: number;
  pct: number;
  toNext: number;
  nextTitle: string | null;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="relative grid size-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] font-heading text-2xl font-extrabold text-white shadow-lift">
          {level}
          <span className="absolute -bottom-1.5 rounded-full bg-white px-1.5 text-[9px] font-bold tracking-wide text-primary uppercase shadow">Lvl</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">XP Level</p>
          <p className="font-heading text-xl font-bold">{title}</p>
          <p className="text-xs text-muted-foreground tabular">{total.toLocaleString("en-MY")} XP total</p>
        </div>
      </div>
      <Progress value={pct} className="mt-4 h-2.5" aria-label="Progress to next XP level" />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {nextTitle ? (
          <>
            <strong className="text-foreground">{toNext.toLocaleString("en-MY")} XP</strong> to Level {level + 1}: {nextTitle}
          </>
        ) : (
          "Maximum level reached"
        )}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">Earn XP by playing, completing missions and keeping your streak. XP Level is separate from Deposit Level.</p>
    </div>
  );
}

type Level = { id: string; name: string; sortOrder: number; threshold: string; color: string; benefits: string[] };

export function DepositLevelCard({
  current,
  next,
  levels,
  total,
  pct,
  toNext,
}: {
  current: Level | null;
  next: Level | null;
  levels: Level[];
  total: string;
  pct: number;
  toNext: bigint;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="grid size-14 place-items-center rounded-2xl text-2xl text-white shadow-lift" style={{ background: current?.color ?? "#64748b" }} aria-hidden>
          💎
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Deposit Level</p>
          <p className="font-heading text-xl font-bold">{current?.name ?? "Starter"}</p>
          <p className="text-xs text-muted-foreground tabular">{formatMYR(total)} total deposits</p>
        </div>
      </div>
      {next && (
        <>
          <Progress value={pct} className="mt-4 h-2.5" indicatorClassName="bg-amber-500" aria-label="Progress to next Deposit Level" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            <strong className="text-foreground">{formatMYR(toNext)}</strong> more in deposits to reach {next.name}
          </p>
        </>
      )}
      {current && current.benefits.length > 0 && (
        <ul className="mt-3 space-y-1">
          {current.benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-primary">All Deposit Levels</summary>
        <ol className="mt-2 space-y-1.5">
          {levels.map((l) => {
            const reached = current && l.sortOrder <= current.sortOrder;
            return (
              <li key={l.id} className={cn("flex items-center gap-2 rounded-lg p-2 text-sm", current?.id === l.id && "bg-surface")}>
                <span className="size-3 rounded-full" style={{ background: l.color }} aria-hidden />
                <span className="flex-1 font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground tabular">{formatMYR(l.threshold)}</span>
                {reached ? <Check className="size-4 text-success" aria-label="Reached" /> : <Lock className="size-3.5 text-muted-foreground" aria-label="Locked" />}
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
