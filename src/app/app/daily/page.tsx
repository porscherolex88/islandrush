import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ART } from "@/components/app/art";
import { CheckInButton, MissionBonusButton, MysteryEventCard, SpinWheel } from "@/components/app/daily-actions";
import { MissionCard, StreakCard, TomorrowTeaser } from "@/components/app/daily-cards";
import { Panel, Section } from "@/components/app/mobile-header";
import { DailyHeader } from "@/components/app/root-page-header";
import { requireUser } from "@/lib/auth/session";
import { getConfig, getTimezone } from "@/server/services/config";
import { getDailyPlan, getDailyState } from "@/server/services/daily";
import { poolOdds } from "@/server/services/mystery-box";

export const metadata: Metadata = { title: "Daily" };

export default async function DailyPage() {
  const user = await requireUser();
  const state = await getDailyState(user.id);
  const [plan, defaults, tz] = await Promise.all([getDailyPlan(state.day), getConfig("daily_defaults"), getTimezone()]);
  const boosted = Boolean(defaults.streakSpinPoolId && state.streak.current >= defaults.streakSpinMinDays);
  const spinPool = boosted ? defaults.streakSpinPoolId : plan.spinPoolId;
  const odds = spinPool ? await poolOdds(spinPool) : [];
  const today = [
    state.loginClaimed,
    ...(state.spinAvailable ? [Boolean(state.spin)] : []),
    ...(state.missions.length ? [state.missionsDone >= state.missions.length] : []),
    ...(state.event ? [Boolean(state.eventClaim)] : []),
  ];

  return (
    <div>
      <DailyHeader userId={user.id} timeZone={tz} streak={state.streak.current} done={today.filter(Boolean).length} total={today.length} />

      <Section>
        <StreakCard
          current={state.streak.current}
          longest={state.streak.longest}
          milestones={state.milestones}
          nextMilestone={state.nextMilestone}
          action={<CheckInButton claimed={state.loginClaimed} streak={state.streak.current} />}
        />
      </Section>

      <Section title="Daily Spin" className="scroll-mt-16">
        <div id="spin" />
        <Panel className="rounded-3xl">
          <SpinWheel entries={odds} spun={state.spin} available={state.spinAvailable} boosted={boosted} />
          {!boosted && defaults.streakSpinPoolId && <p className="mt-2 text-center text-xs text-muted-foreground">Reach a {defaults.streakSpinMinDays}-day streak to unlock the boosted Streak Spin.</p>}
        </Panel>
      </Section>

      <Section
        title="Today's Missions"
        action={
          <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-primary tabular">
            {state.missionsDone} / {state.missions.length} completed
          </span>
        }
      >
        <div id="missions" className="scroll-mt-16 space-y-2">
          {state.missions.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
          <MissionBonusButton done={state.missionsDone} total={state.missions.length} claimed={state.bonusClaimed} />
        </div>
      </Section>

      <Section title="Today's Mystery">
        <div id="event" className="scroll-mt-16">
          <MysteryEventCard event={state.event} claim={state.eventClaim} />
        </div>
      </Section>

      <Section title="Free Discoveries">
        <Link href="/app/play/map" className="group relative isolate flex min-h-28 items-center gap-4 overflow-hidden rounded-3xl p-4 text-white shadow-card">
          <Image src={ART.island} alt="" fill sizes="(max-width: 430px) 100vw, 430px" className="-z-10 object-cover object-[center_75%]" />
          <span aria-hidden className="art-scrim absolute inset-0 -z-10" />
          <span className="flex-1">
            <span className="block font-heading text-3xl font-extrabold tabular">
              {state.freeDiscoveriesLeft} / {state.freeDiscoveries}
            </span>
            <span className="text-sm text-white/85">free map discoveries remaining today</span>
          </span>
          <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-foreground">
            <Compass className="size-4" aria-hidden /> Explore
          </span>
        </Link>
      </Section>

      <Section>
        <TomorrowTeaser title={state.teaser.title} text={state.teaser.text} />
      </Section>
    </div>
  );
}
