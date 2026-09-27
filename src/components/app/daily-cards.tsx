import { Check, ChevronRight, Flame, Moon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Token } from "./art";

export type MissionView = { id: string; title: string; icon: string; target: number; progress: number; completed: boolean };

export function MissionCard({ mission }: { mission: MissionView }) {
  const shown = Math.min(mission.progress, mission.target);
  const pct = Math.round((shown / mission.target) * 100);
  return (
    <div className={cn("flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-3 shadow-card", mission.completed && "border-success/30 bg-success-soft/60")}>
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

/**
 * Streak with a single milestone track: milestones sit on one line at their day count,
 * the fill shows today's streak, and the copy says how far the next reward is.
 */
export function StreakCard({
  current,
  longest,
  milestones,
  nextMilestone,
  action,
}: {
  current: number;
  longest: number;
  milestones: { id: string; days: number; title: string; reached: boolean }[];
  nextMilestone: { days: number; title: string } | null;
  action?: ReactNode;
}) {
  const max = Math.max(current, ...milestones.map((m) => m.days), 1);
  const pos = (d: number) => `${(d / max) * 100}%`;
  const toNext = nextMilestone ? nextMilestone.days - current : 0;
  return (
    <div className="rounded-3xl border bg-[linear-gradient(135deg,oklch(0.97_0.05_60),oklch(0.99_0.02_85))] p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="grid size-14 place-items-center rounded-2xl bg-[linear-gradient(180deg,#fb923c,#ea580c)] text-white shadow-lift">
          <Flame className="size-8" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="font-heading text-3xl leading-none font-extrabold tabular">
            {current} <span className="text-lg font-bold">day{current === 1 ? "" : "s"}</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-orange-800">
            {nextMilestone ? `${toNext} day${toNext === 1 ? "" : "s"} to your next reward` : "Every streak reward collected"}
          </p>
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="mt-6 px-3 pb-7">
          <div className="relative h-2.5 rounded-full bg-orange-100" role="img" aria-label={`Streak ${current} days. Milestones at ${milestones.map((m) => m.days).join(", ")} days.`}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#fdba74,#f97316)]" style={{ width: pos(Math.min(current, max)) }} />
            {milestones.map((m) => (
              <div key={m.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pos(m.days) }}>
                <span className={cn("grid size-6 place-items-center rounded-full border-2 text-white", m.reached ? "border-orange-500 bg-orange-500" : "border-orange-300 bg-white")}>
                  {m.reached && <Check className="size-3.5" aria-hidden />}
                </span>
                <span className={cn("absolute top-7 left-1/2 -translate-x-1/2 text-xs font-bold tabular", m.reached ? "text-orange-700" : "text-muted-foreground")}>{m.days}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{nextMilestone ? <>Next: <strong className="text-foreground">{nextMilestone.title}</strong> at {nextMilestone.days} days</> : "Legendary dedication!"}</span>
        <span>Best: {longest} days</span>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function TomorrowTeaser({ title, text }: { title: string; text: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,oklch(0.3_0.06_240),oklch(0.2_0.05_255))] p-5 text-white shadow-card">
      <div aria-hidden className="absolute top-3 right-4 text-amber-100/25">
        <Moon className="size-16" />
      </div>
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-200 uppercase">
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
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {done ? (
        <span className="grid size-7 place-items-center rounded-full bg-success text-white" aria-label="Done">
          <Check className="size-4" />
        </span>
      ) : cta ? (
        <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{cta}</span>
      ) : (
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      )}
    </Link>
  );
}
