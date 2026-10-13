import { Check, Flame, Gift } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Token } from "./art";

const WHEEL = "bg-[conic-gradient(#f6c453_0_12.5%,#13798a_0_25%,#fbe3a1_0_37.5%,#0b4f5c_0_50%,#f2b134_0_62.5%,#1a8fa1_0_75%,#fdf0c8_0_87.5%,#0f5e6e_0)]";

/** Home's half-width Daily Spin card; pairs with CheckInCard. */
export function SpinCard({ spun, available }: { spun: boolean; available: boolean }) {
  return (
    <Link
      href="/daily#spin"
      className="group relative isolate flex flex-col overflow-hidden rounded-2xl bg-[linear-gradient(160deg,var(--ocean),var(--ocean-deep))] p-3 text-white outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
    >
      <span aria-hidden className={cn("absolute -top-6 -right-6 -z-10 size-24 rounded-full opacity-20 transition-transform duration-700 group-hover:rotate-45", WHEEL)} />
      <span className={cn("relative grid size-11 place-items-center rounded-full inset-ring-2 inset-ring-white/90 shadow-sm shadow-black/30", WHEEL)} aria-hidden>
        <span className="size-3 rounded-full bg-white ring-2 ring-amber-300" />
      </span>
      <p className="mt-3 font-heading text-lg leading-tight font-extrabold">Daily Spin</p>
      <p className="mt-1 mb-3 text-sm text-white/75">{spun ? "Spun today. Back tomorrow!" : available ? "Your free spin is ready." : "No spin today."}</p>
      <span
        className={cn(
          buttonVariants({ variant: spun ? "secondary" : "gold", size: "pill" }),
          "mt-auto w-full",
          spun ? "bg-white/15 text-white" : "group-hover:brightness-105",
          !spun && !available && "opacity-60",
        )}
      >
        {spun ? <Check aria-hidden /> : null}
        {spun ? "Done" : "Spin now"}
      </span>
    </Link>
  );
}

export type MissionView = { id: string; title: string; icon: string; target: number; progress: number; completed: boolean };

export function MissionCard({ mission }: { mission: MissionView }) {
  const shown = Math.min(mission.progress, mission.target);
  const pct = Math.round((shown / mission.target) * 100);
  return (
    <div className={cn("flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-3", mission.completed && "border-success/30 bg-success-soft/60")}>
      <Token icon={mission.icon} rarity={mission.completed ? "UNCOMMON" : "COMMON"} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{mission.title}</p>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={pct} className="h-2" indicatorClassName={mission.completed ? "bg-success" : "bg-amber-500"} aria-label={`${mission.title} progress`} />
          <span className="text-xs font-bold tabular">
            {shown}/{mission.target}
          </span>
        </div>
      </div>
      {mission.completed && (
        <span className="grid size-8 place-items-center rounded-full bg-success text-white" aria-label="Completed">
          <Check className="size-4" />
        </span>
      )}
    </div>
  );
}

const WEEK = 7;

/**
 * Streak as a 7-day week that restarts after day 7. Days already checked in this week are
 * filled, today is highlighted, and days that land on a streak reward carry a gift.
 */
export function StreakCard({
  current,
  milestones,
  nextMilestone,
  checkedInToday,
  action,
}: {
  current: number;
  milestones: { id: string; days: number; title: string; reached: boolean }[];
  nextMilestone: { days: number; title: string } | null;
  checkedInToday: boolean;
  action?: ReactNode;
}) {
  const toNext = nextMilestone ? nextMilestone.days - current : 0;
  // Before today's check-in, a finished week means today starts a fresh one.
  const done = checkedInToday ? ((Math.max(current, 1) - 1) % WEEK) + 1 : current % WEEK;
  const weekStart = current - done;
  const todayIndex = checkedInToday ? done - 1 : done;
  const rewardDays = new Set(milestones.map((m) => m.days));
  return (
    <div className="rounded-3xl border bg-[linear-gradient(135deg,var(--gold-soft),var(--warm-soft))] p-5">
      <div className="flex items-center gap-3">
        <div className="grid size-14 place-items-center rounded-full bg-[linear-gradient(180deg,var(--color-orange-400),var(--color-orange-600))] text-white">
          <Flame className="size-8" aria-hidden />
        </div>
        <div className="flex-1">
          {nextMilestone ? (
            <>
              <p className="font-heading text-3xl leading-none font-extrabold tabular">
                {toNext} <span className="text-lg font-bold">day{toNext === 1 ? "" : "s"} to go</span>
              </p>
              <p className="mt-1 text-sm font-semibold text-orange-800">until your next streak reward</p>
            </>
          ) : (
            <>
              <p className="font-heading text-2xl leading-none font-extrabold">All rewards collected</p>
              <p className="mt-1 text-sm font-semibold text-orange-800 tabular">{current}-day streak and counting</p>
            </>
          )}
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1.5" aria-label={`This week: ${done} of ${WEEK} days checked in`}>
        {Array.from({ length: WEEK }, (_, i) => {
          const filled = i < done;
          const isToday = i === todayIndex;
          const reward = rewardDays.has(weekStart + i + 1);
          return (
            <li key={i} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "relative grid aspect-square w-full max-w-10 place-items-center rounded-full text-white transition-colors",
                  filled ? "bg-[linear-gradient(180deg,var(--color-orange-400),var(--color-orange-600))]" : "border-2 border-dashed border-orange-200 bg-white/80 text-orange-300",
                  isToday && (filled ? "ring-2 ring-orange-300 ring-offset-2 ring-offset-orange-50" : "border-solid border-orange-400 text-orange-500"),
                )}
                aria-hidden
              >
                {filled ? <Check className="size-4" strokeWidth={3} /> : reward ? <Gift className="size-4" /> : <Flame className="size-4" />}
                {reward && filled && (
                  <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-gold-soft text-gold-foreground ring-2 ring-orange-50">
                    <Gift className="size-2.5" />
                  </span>
                )}
              </span>
              <span className={cn("text-[11px] font-bold tabular", isToday ? "text-orange-700" : filled ? "text-orange-600" : "text-muted-foreground")}>
                {isToday ? "Today" : `Day ${i + 1}`}
              </span>
            </li>
          );
        })}
      </ol>

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
