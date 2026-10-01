import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ART, mapArt } from "@/components/app/art";
import { buttonVariants } from "@/components/ui/button";
import { CheckInButton, MissionBonusButton, MysteryEventCard, SpinWheel } from "@/components/app/daily-actions";
import { MissionCard, StreakCard } from "@/components/app/daily-cards";
import { Panel, Section } from "@/components/app/mobile-header";
import { DailyHeader } from "@/components/app/root-page-header";
import { requireUser } from "@/lib/auth/session";
import { getAdventureState } from "@/server/services/adventure";
import { getConfig, getTimezone } from "@/server/services/config";
import { getDailyPlan, getDailyState } from "@/server/services/daily";
import { poolOdds } from "@/server/services/mystery-box";

export const metadata: Metadata = { title: "Daily" };

export default async function DailyPage() {
  const user = await requireUser();
  const state = await getDailyState(user.id);
  const [plan, defaults, tz, adventure] = await Promise.all([getDailyPlan(state.day), getConfig("daily_defaults"), getTimezone(), getAdventureState(user.id)]);
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
      <DailyHeader timeZone={tz} streak={state.streak.current} done={today.filter(Boolean).length} total={today.length} />

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
        <div id="missions" className="scroll-mt-20 space-y-2">
          {state.missions.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
          <MissionBonusButton done={state.missionsDone} total={state.missions.length} claimed={state.bonusClaimed} />
        </div>
      </Section>

      <Section title="Today's Mystery">
        <div id="event" className="scroll-mt-20">
          <MysteryEventCard event={state.event} claim={state.eventClaim} />
        </div>
      </Section>

      <Section title="Your Adventure">
        <Link href={adventure.nextStep.href} className="group relative isolate flex min-h-28 items-center gap-4 overflow-hidden rounded-3xl p-4 text-white">
          <Image src={adventure.currentMap ? mapArt(adventure.currentMap.level, adventure.currentMap.artwork) : ART.island} alt="" fill sizes="(max-width: 430px) 100vw, 430px" className="-z-10 object-cover" />
          <span aria-hidden className="art-scrim absolute inset-0 -z-10" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold tracking-wide text-amber-200 uppercase tabular">
              Level {adventure.currentLevel}/{adventure.totalLevels}
            </span>
            <span className="block font-heading text-xl leading-tight font-extrabold">{adventure.nextStep.title}</span>
            <span className="block truncate text-sm text-white/85">{adventure.nextStep.detail}</span>
          </span>
          <span className={buttonVariants({ variant: "gold", size: "pill" })}>Go</span>
        </Link>
      </Section>
    </div>
  );
}
