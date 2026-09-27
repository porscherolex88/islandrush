import type { Metadata } from "next";
import Link from "next/link";
import { CheckInCard, MissionBonusButton, MysteryEventCard, SpinWheel } from "@/components/app/daily-actions";
import { MissionCard, StreakCard, TomorrowTeaser } from "@/components/app/daily-cards";
import { PageHeader, Panel, Section } from "@/components/app/mobile-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getConfig } from "@/server/services/config";
import { getDailyPlan, getDailyState } from "@/server/services/daily";
import { poolOdds } from "@/server/services/mystery-box";

export const metadata: Metadata = { title: "Daily" };

export default async function DailyPage() {
  const user = await requireUser();
  const state = await getDailyState(user.id);
  const [plan, defaults] = await Promise.all([getDailyPlan(state.day), getConfig("daily_defaults")]);
  const boosted = Boolean(defaults.streakSpinPoolId && state.streak.current >= defaults.streakSpinMinDays);
  const spinPool = boosted ? defaults.streakSpinPoolId : plan.spinPoolId;
  const odds = spinPool ? await poolOdds(spinPool) : [];

  return (
    <div>
      <PageHeader title="Daily" subtitle="Fresh rewards every day. Resets at midnight." back="/app" />

      <Section>
        <StreakCard current={state.streak.current} longest={state.streak.longest} milestones={state.milestones} nextMilestone={state.nextMilestone} />
      </Section>

      <Section>
        <CheckInCard claimed={state.loginClaimed} streak={state.streak.current} />
      </Section>

      <Section title="Daily Spin" className="scroll-mt-16" >
        <div id="spin" />
        <Panel>
          <SpinWheel entries={odds} spun={state.spin} available={state.spinAvailable} boosted={boosted} />
          {!boosted && defaults.streakSpinPoolId && (
            <p className="mt-3 text-center text-xs text-muted-foreground">Reach a {defaults.streakSpinMinDays}-day streak to unlock the boosted Streak Spin.</p>
          )}
        </Panel>
      </Section>

      <Section title={`Daily Missions · ${state.missionsDone}/${state.missions.length}`}>
        <div id="missions" className="space-y-2">
          {state.missions.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
          <MissionBonusButton done={state.missionsDone} total={state.missions.length} claimed={state.bonusClaimed} />
        </div>
      </Section>

      <Section title="Daily Mystery Event">
        <div id="event">
          <MysteryEventCard event={state.event} claim={state.eventClaim} />
        </div>
      </Section>

      <Section title="Daily Discoveries">
        <Panel className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-3xl" aria-hidden>
            🧭
          </div>
          <div className="flex-1">
            <p className="font-semibold">
              {state.freeDiscoveriesLeft} of {state.freeDiscoveries} free discoveries left
            </p>
            <p className="text-xs text-muted-foreground">Uncover Mystery Map tiles without spending Credits.</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/app/play/map">Explore</Link>
          </Button>
        </Panel>
      </Section>

      <Section>
        <TomorrowTeaser title={state.teaser.title} text={state.teaser.text} />
      </Section>
    </div>
  );
}
