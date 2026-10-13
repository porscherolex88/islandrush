import { CalendarClock, Gift } from "lucide-react";
import type { Metadata } from "next";
import { CheckInButton, MissionBonusButton, SpinWheel } from "@/components/app/daily-actions";
import { MissionCard, StreakCard } from "@/components/app/daily-cards";
import { Panel, Section } from "@/components/app/mobile-header";
import { DailyHeader } from "@/components/app/root-page-header";
import { requireUser } from "@/lib/auth/session";
import { getConfig, getTimezone } from "@/server/services/config";
import { dailyChecklist, getDailyPlan, getDailyState } from "@/server/services/daily";
import { boxPrizes } from "@/server/services/mystery-box";

export const metadata: Metadata = { title: "Daily" };

export default async function DailyPage() {
  const user = await requireUser();
  const state = await getDailyState(user.id);
  const [plan, defaults, tz] = await Promise.all([getDailyPlan(state.day), getConfig("daily_defaults"), getTimezone()]);
  const boosted = Boolean(defaults.streakSpinPoolId && state.streak.current >= defaults.streakSpinMinDays);
  const spinPool = boosted ? defaults.streakSpinPoolId : plan.spinPoolId;
  const prizes = spinPool ? await boxPrizes(spinPool) : [];
  const { done, total } = dailyChecklist(state);
  const tomorrowStreak = state.streak.current + (state.loginClaimed ? 1 : 2);
  const milestone = state.nextMilestone;

  return (
    <div>
      <DailyHeader timeZone={tz} streak={state.streak.current} done={done} total={total} />

      <Section>
        <StreakCard
          current={state.streak.current}
          milestones={state.milestones}
          nextMilestone={state.nextMilestone}
          checkedInToday={state.loginClaimed}
          action={<CheckInButton claimed={state.loginClaimed} streak={state.streak.current} />}
        />
      </Section>

      <Section title="Daily Spin" className="scroll-mt-20">
        <div id="spin" />
        <Panel className="rounded-3xl">
          <SpinWheel entries={prizes} spun={state.spin} available={state.spinAvailable} boosted={boosted} />
          {!boosted && defaults.streakSpinPoolId && <p className="mt-2 text-center text-xs text-muted-foreground">Reach a {defaults.streakSpinMinDays}-day streak to unlock the boosted Streak Spin.</p>}
        </Panel>
      </Section>

      <Section
        title="Daily Missions"
        action={
          <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-primary tabular">
            {state.missionsDone} / {state.missions.length}
          </span>
        }
      >
        <div id="missions" className="scroll-mt-20 space-y-2">
          {state.missions.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
          <MissionBonusButton done={state.missionsDone} total={state.missions.length} claimed={state.bonusClaimed} />
        </div>
      </Section>

      <Section title="Tomorrow" className="pb-6">
        <div className="flex items-start gap-3 rounded-2xl border border-dashed bg-surface/60 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-primary ring-1 ring-border">
            <CalendarClock className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-bold">
              {state.loginClaimed ? "Check in for day " : "Check in today, then tomorrow is day "}
              <span className="tabular">{tomorrowStreak}</span> of your streak
            </p>
            <p className="mt-0.5 text-muted-foreground">A fresh spin and three new missions arrive every day.</p>
            {milestone && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gold-foreground">
                <Gift className="size-3.5" aria-hidden />
                {milestone.title} on day {milestone.days} of every week
              </p>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
