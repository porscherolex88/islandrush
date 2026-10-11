import { ChevronRight, Map as MapIcon, Puzzle, Sparkles, Target, Users } from "lucide-react";
import Link from "next/link";
import { ArtCard, ART, StatRow, mapArt } from "@/components/app/art";
import { BannerCarousel } from "@/components/app/banner-carousel";
import { CheckInCard } from "@/components/app/daily-actions";
import { SpinCard } from "@/components/app/daily-cards";
import { Section } from "@/components/app/mobile-header";
import { Leaderboard } from "@/components/app/leaderboard";
import { HomeHeader } from "@/components/app/root-page-header";
import { requireUser } from "@/lib/auth/session";
import { greeting } from "@/lib/time";
import { activeBanners } from "@/server/queries/banners";
import { getLeaderboards } from "@/server/queries/leaderboard";
import { settleDueRewards } from "@/server/services/cash-rewards";
import { getTimezone } from "@/server/services/config";
import { getDailyState } from "@/server/services/daily";
import { getAdventureState } from "@/server/services/adventure";

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const user = await requireUser();
  await settleDueRewards({ userId: user.id, limit: 50 });
  const [daily, adventure, tz, banners, sp, boards] = await Promise.all([
    getDailyState(user.id),
    getAdventureState(user.id),
    getTimezone(),
    activeBanners(),
    searchParams,
    getLeaderboards(user.id),
  ]);
  const firstName = user.name.split(" ")[0];
  const map = adventure.currentMap;
  const box = adventure.currentBox;

  return (
    <div className="pb-4">
      <HomeHeader
        userId={user.id}
        name={user.name}
        greeting={greeting(new Date(), tz)}
        streak={daily.streak.current}
      />
      <div className="mt-3 space-y-3">
        {sp.welcome && (
          <div className="px-4">
            <div className="rounded-2xl bg-brand-soft p-3 text-sm text-primary">
              <strong>Welcome to LootBox, {firstName}!</strong> Start with your free daily check-in and spin below.
            </div>
          </div>
        )}

        {map && (
          <Section className="py-0">
            <ArtCard
              href="/play/map"
              art={mapArt(map.level, map.artwork)}
              eyebrow={`Adventure Level ${adventure.currentLevel} of ${adventure.totalLevels}`}
              title={map.name}
              body={map.state === "completed" ? "Map complete." : `Next: ${adventure.nextStep.title}`}
              cta="Explore map"
              top
              priority
            />
          </Section>
        )}

        <BannerCarousel banners={banners.map(({ id, title, body, link }) => ({ id: String(id), title, body: body ?? null, link: link ?? null }))} />

        <Section className="pt-3 pb-0" title="Today's progress" action={<Link href="/daily" className="flex h-11 items-center text-sm font-semibold text-primary">Daily</Link>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <CheckInCard claimed={daily.loginClaimed} streak={daily.streak.current} />
              <SpinCard spun={Boolean(daily.spin)} available={daily.spinAvailable} />
            </div>
            {daily.missions.length > 0 && (
              <StatRow href="/daily#missions" icon={<Target className="size-5" />} label="Missions" value={`${daily.missionsDone}/${daily.missions.length}`} done={daily.missionsDone >= daily.missions.length} />
            )}
            {daily.event && (
              <StatRow href="/daily#event" icon={<Sparkles className="size-5" />} label={`Daily Mystery: ${daily.event.title}`} value={daily.eventClaim ? "Done" : "Explore"} done={Boolean(daily.eventClaim)} />
            )}
          </div>
        </Section>

        <Section className="pt-3 pb-0" title="Continue your journey">
          <div className="grid grid-cols-2 gap-3">
            {map && (
              <Link href="/play/map" className="group relative isolate flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl p-3 text-white">
                <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${mapArt(map.level, map.artwork)})` }} />
                <span aria-hidden className="art-scrim-b absolute inset-0 -z-10" />
                <span className="flex items-center gap-1 text-xs font-semibold text-white/85">
                  <MapIcon className="size-3.5" aria-hidden /> Adventure Level {map.level}
                </span>
                <span className="font-heading text-xl font-extrabold tabular">
                  {map.state === "exploring" || map.state === "completed" ? `${map.checkpointsDone}/${map.checkpoints.length}` : `${Math.min(map.lootCollected, map.lootRequired)}/${map.lootRequired}`}
                </span>
                <span className="text-xs text-white/80">{map.state === "exploring" || map.state === "completed" ? "checkpoints" : "Loot to unlock"}</span>
              </Link>
            )}
            <Link href="/play/prizes" className="group relative isolate flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl p-3 text-white">
              <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${ART.bigBox})` }} />
              <span aria-hidden className="art-scrim-b absolute inset-0 -z-10" />
              <span className="flex items-center gap-1 text-xs font-semibold text-white/85">
                <Puzzle className="size-3.5" aria-hidden /> Prizes
              </span>
              <span className="font-heading text-xl font-extrabold tabular">{adventure.totalPieces}</span>
              <span className="text-xs text-white/80">puzzle {adventure.totalPieces === 1 ? "piece" : "pieces"}</span>
            </Link>
          </div>
          <Link href={box ? `/play/mystery-box?level=${box.level}` : "/play/mystery-box"} className="group relative isolate mt-3 flex min-h-20 items-center overflow-hidden rounded-2xl px-4 text-white">
            <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${ART.boxHub})` }} />
            <span aria-hidden className="art-scrim absolute inset-0 -z-10" />
            <span className="flex-1">
              <span className="block font-heading text-lg font-extrabold">{box ? box.name : "Mystery Box"}</span>
              <span className="text-xs text-white/85">{box ? `Adventure Level ${box.level}. Open it to collect Loot.` : "Open it to collect Loot."}</span>
            </span>
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </Section>

        <Section className="pt-3 pb-0" title="Leaderboard">
          <Leaderboard boards={boards} />
        </Section>

        <Section className="py-0">
          <Link href="/invite" className="flex min-h-16 items-center gap-3 rounded-3xl border bg-card p-3 hover:bg-surface">
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
      </div>
    </div>
  );
}
