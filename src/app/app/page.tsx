import { CalendarCheck, ChevronRight, Map as MapIcon, Puzzle, Target, Users } from "lucide-react";
import Link from "next/link";
import { ArtCard, ART, StatRow, mapArt } from "@/components/app/art";
import { BannerCarousel } from "@/components/app/banner-carousel";
import { CheckInCard } from "@/components/app/daily-actions";
import { TomorrowTeaser } from "@/components/app/daily-cards";
import { Section } from "@/components/app/mobile-header";
import { HomeHeader } from "@/components/app/root-page-header";
import { requireUser } from "@/lib/auth/session";
import { greeting } from "@/lib/time";
import { activeBanners } from "@/server/queries/banners";
import { settleDueRewards } from "@/server/services/cash-rewards";
import { getTimezone } from "@/server/services/config";
import { getDailyState } from "@/server/services/daily";
import { getAdventureState } from "@/server/services/adventure";
import { levelProgress } from "@/server/services/xp";
import { db } from "@/db";

export default async function HomePage({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  await settleDueRewards({ userId: user.id, limit: 50 });
  const [daily, adventure, tz, banners, sp, xp] = await Promise.all([
    getDailyState(user.id),
    getAdventureState(user.id),
    getTimezone(),
    activeBanners(),
    searchParams,
    levelProgress(db, user.xpTotal, user.xpLevel),
  ]);
  const firstName = user.name.split(" ")[0];
  const map = adventure.currentMap;
  const box = adventure.currentBox;
  const showMystery = Boolean(daily.event && !daily.eventClaim);

  return (
    <div className="space-y-1 pb-2">
      <HomeHeader
        userId={user.id}
        name={user.name}
        greeting={greeting(new Date(), tz)}
        streak={daily.streak.current}
        level={user.xpLevel}
        title={xp.current?.title ?? "Explorer"}
        pct={xp.pct}
      />
      {sp.welcome && (
        <div className="px-4">
          <div className="rounded-2xl bg-brand-soft p-3 text-sm text-primary">
            <strong>Welcome to LootBox, {firstName}!</strong> Start with your free daily check-in and spin below.
          </div>
        </div>
      )}

      <Section>
        {showMystery && daily.event ? (
          <ArtCard
            href="/app/daily#event"
            art={ART.tidePool}
            eyebrow="Something is waiting..."
            title={daily.event.title}
            body="Something washed ashore today."
            cta="Explore"
            tall
            priority
          />
        ) : (
          <ArtCard
            href={adventure.nextStep.href}
            art={map ? mapArt(map.level, map.artwork) : ART.island}
            eyebrow={`Your adventure · Level ${adventure.currentLevel}/${adventure.totalLevels}`}
            title={adventure.nextStep.title}
            body={adventure.nextStep.detail}
            cta="Continue"
            tall
            priority
          />
        )}
      </Section>

      <BannerCarousel banners={banners.map(({ id, title, body, link }) => ({ id: String(id), title, body: body ?? null, link: link ?? null }))} />

      <Section title="Today's progress" action={<Link href="/app/daily" className="flex h-11 items-center text-sm font-semibold text-primary">Daily</Link>}>
        <div className="space-y-2">
          {!daily.loginClaimed && <CheckInCard claimed={daily.loginClaimed} streak={daily.streak.current} />}
          <StatRow href="/app/daily#spin" icon={<CalendarCheck className="size-5" />} label="Daily Spin" value={daily.spin ? "✓" : daily.spinAvailable ? "Free" : "-"} done={Boolean(daily.spin)} />
          <StatRow href="/app/daily#missions" icon={<Target className="size-5" />} label="Missions" value={`${daily.missionsDone}/${daily.missions.length}`} done={daily.bonusClaimed} />
          {adventure.maps.length > 0 && (
            <StatRow href="/app/play" icon={<MapIcon className="size-5" />} label="Maps completed" value={`${adventure.completedMaps}/${adventure.maps.length}`} done={adventure.completedMaps === adventure.maps.length} />
          )}
        </div>
      </Section>

      <Section title="Continue your journey">
        <div className="grid grid-cols-2 gap-2">
          {map && (
            <Link href={`/app/play/map?level=${map.level}`} className="group relative isolate flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl p-3 text-white">
              <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${mapArt(map.level, map.artwork)})` }} />
              <span aria-hidden className="art-scrim-b absolute inset-0 -z-10" />
              <span className="flex items-center gap-1 text-xs font-semibold text-white/85">
                <MapIcon className="size-3.5" aria-hidden /> Map {map.level}
              </span>
              <span className="font-heading text-xl font-extrabold tabular">
                {map.state === "exploring" || map.state === "completed" ? `${map.checkpointsDone}/${map.checkpoints.length}` : `${Math.min(map.lootCollected, map.lootRequired)}/${map.lootRequired}`}
              </span>
              <span className="text-xs text-white/80">{map.state === "exploring" || map.state === "completed" ? "checkpoints" : "Loot to unlock"}</span>
            </Link>
          )}
          <Link href="/app/play/prizes" className="group relative isolate flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl p-3 text-white">
            <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${ART.vault})` }} />
            <span aria-hidden className="art-scrim-b absolute inset-0 -z-10" />
            <span className="flex items-center gap-1 text-xs font-semibold text-white/85">
              <Puzzle className="size-3.5" aria-hidden /> Prizes
            </span>
            <span className="font-heading text-xl font-extrabold tabular">{adventure.totalPieces}</span>
            <span className="text-xs text-white/80">puzzle {adventure.totalPieces === 1 ? "piece" : "pieces"}</span>
          </Link>
        </div>
        <Link href={box ? `/app/play/mystery-box?level=${box.level}` : "/app/play/mystery-box"} className="group relative isolate mt-2 flex min-h-20 items-center overflow-hidden rounded-2xl px-4 text-white">
          <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${ART.boxHub})` }} />
          <span aria-hidden className="art-scrim absolute inset-0 -z-10" />
          <span className="flex-1">
            <span className="block font-heading text-lg font-extrabold">{box ? box.name : "Mystery Box"}</span>
            <span className="text-xs text-white/85">{box ? `Level ${box.level} · collect Loot to unlock maps` : "Collect Loot to unlock maps"}</span>
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </Section>

      <Section>
        <Link href="/app/referrals" className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 hover:bg-surface">
          <span className="grid size-11 place-items-center rounded-full bg-gold-soft text-gold-foreground">
            <Users className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold">Invite friends</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">Earn a reward when they make their first deposit</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      </Section>

      <Section>
        <TomorrowTeaser title={daily.teaser.title} text={daily.teaser.text} />
      </Section>
    </div>
  );
}
