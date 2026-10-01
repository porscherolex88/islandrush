import { Check, ChevronRight, Flame, Gift, Moon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Token } from "./art";

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
    <div className="rounded-3xl border bg-[linear-gradient(135deg,oklch(0.97_0.05_60),oklch(0.99_0.02_85))] p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-14 place-items-center rounded-full bg-[linear-gradient(180deg,#fb923c,#ea580c)] text-white">
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
                  filled ? "bg-[linear-gradient(180deg,#fb923c,#ea580c)]" : "border-2 border-dashed border-orange-200 bg-white/80 text-orange-300",
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

export function TomorrowTeaser({ title, text }: { title: string; text: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,oklch(0.3_0.06_240),oklch(0.2_0.05_255))] p-5 text-white">
      <div aria-hidden className="absolute top-3 right-4 text-amber-100/25">
        <Moon className="size-16" />
      </div>
      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
        <Moon className="size-3.5" aria-hidden /> {title}
      </p>
      <p className="relative mt-1 max-w-[80%] font-heading text-lg font-semibold">{text}</p>
      <p className="relative mt-1 text-xs text-white/65">New spin, missions and mystery at midnight (Malaysia time).</p>
    </div>
  );
}

export function TodayRow({ href, icon, title, meta, done, cta }: { href: string; icon: ReactNode; title: string; meta: string; done?: boolean; cta?: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-surface">
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {done ? (
        <span className="grid size-7 place-items-center rounded-full bg-success text-white" aria-label="Done">
          <Check className="size-4" />
        </span>
      ) : cta ? (
        <span className={buttonVariants({ variant: "gold", size: "pill" })}>{cta}</span>
      ) : (
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      )}
    </Link>
  );
}
