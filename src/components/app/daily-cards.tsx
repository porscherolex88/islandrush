import { Check, ChevronRight, Flame, Moon } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type MissionView = { id: string; title: string; icon: string; target: number; progress: number; completed: boolean };

export function MissionCard({ mission }: { mission: MissionView }) {
  const pct = Math.round((mission.progress / mission.target) * 100);
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3", mission.completed && "border-success/30 bg-success-soft/50")}>
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-2xl" aria-hidden>
        {mission.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{mission.title}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Progress value={pct} className="h-1.5" aria-label={`${mission.title} progress`} />
          <span className="text-xs font-semibold text-muted-foreground tabular">
            {mission.progress}/{mission.target}
          </span>
        </div>
      </div>
      {mission.completed && (
        <span className="grid size-7 place-items-center rounded-full bg-success text-white" aria-label="Completed">
          <Check className="size-4" />
        </span>
      )}
    </div>
  );
}

export function StreakCard({
  current,
  longest,
  milestones,
  nextMilestone,
  compact,
}: {
  current: number;
  longest: number;
  milestones: { id: string; days: number; title: string; reached: boolean }[];
  nextMilestone: { days: number; title: string } | null;
  compact?: boolean;
}) {
  const next = nextMilestone?.days ?? current;
  const prev = [...milestones].reverse().find((m) => m.days <= current)?.days ?? 0;
  const pct = nextMilestone ? Math.round(((current - prev) / Math.max(1, next - prev)) * 100) : 100;
  return (
    <div className="rounded-2xl border bg-[linear-gradient(135deg,oklch(0.97_0.04_60),oklch(0.99_0.02_85))] p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-orange-500/10 text-orange-500">
          <Flame className="size-7" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="font-heading text-2xl font-extrabold tabular">
            {current} <span className="text-base font-bold text-muted-foreground">day streak</span>
          </p>
          <p className="text-xs text-muted-foreground">Longest: {longest} days</p>
        </div>
      </div>
      {!compact && (
        <>
          <div className="mt-4 flex items-center justify-between gap-1" role="list" aria-label="Streak milestones">
            {milestones.map((m) => (
              <div key={m.id} role="listitem" className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    "grid size-10 place-items-center rounded-full border-2 text-sm font-bold",
                    m.reached ? "border-orange-400 bg-orange-400 text-white" : "border-dashed border-orange-300 text-orange-500",
                  )}
                  aria-label={`${m.days} days${m.reached ? ", reached" : ""}`}
                >
                  {m.reached ? <Check className="size-4" /> : m.days}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{m.days}d</span>
              </div>
            ))}
          </div>
          {nextMilestone ? (
            <div className="mt-3">
              <Progress value={pct} className="h-2 bg-orange-100" indicatorClassName="bg-orange-400" aria-label="Progress to next milestone" />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {nextMilestone.days - current} more day{nextMilestone.days - current === 1 ? "" : "s"} to <strong className="text-foreground">{nextMilestone.title}</strong>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-orange-600">Every milestone reached. Legendary dedication!</p>
          )}
        </>
      )}
    </div>
  );
}

export function TomorrowTeaser({ title, text }: { title: string; text: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,oklch(0.3_0.08_280),oklch(0.22_0.06_270))] p-4 text-white">
      <div aria-hidden className="absolute top-3 right-4 text-white/15">
        <Moon className="size-16" />
      </div>
      <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">🌙 {title}</p>
      <p className="relative mt-1 font-heading text-lg font-semibold">{text}</p>
      <p className="relative mt-1 text-xs text-white/60">New spin, missions and event at midnight (Malaysia time).</p>
    </div>
  );
}

export function TodayRow({
  href,
  icon,
  title,
  meta,
  done,
  cta,
}: {
  href: string;
  icon: string;
  title: string;
  meta: string;
  done?: boolean;
  cta?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-surface">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-2xl" aria-hidden>
        {icon}
      </div>
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
