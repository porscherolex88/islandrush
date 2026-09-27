import { Flame } from "lucide-react";
import Link from "next/link";
import { CheckInCard } from "@/components/app/daily-actions";
import { TodayRow, TomorrowTeaser } from "@/components/app/daily-cards";
import { GameCard } from "@/components/app/game-card";
import { Section } from "@/components/app/mobile-header";
import { WalletSummary } from "@/components/app/wallet-summary";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { greeting } from "@/lib/time";
import { activeBanners } from "@/server/queries/banners";
import { settleDueRewards } from "@/server/services/cash-rewards";
import { getTimezone } from "@/server/services/config";
import { getDailyState } from "@/server/services/daily";
import { getBalances } from "@/server/services/ledger";
import { getMapState } from "@/server/services/map";
import { getVaultStates } from "@/server/services/vault";

export default async function HomePage({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  await settleDueRewards({ userId: user.id, limit: 50 });
  const [balances, daily, map, vaults, tz, banners, sp] = await Promise.all([
    getBalances(user.id),
    getDailyState(user.id),
    getMapState(user.id),
    getVaultStates(user.id),
    getTimezone(),
    activeBanners(),
    searchParams,
  ]);
  const vault = vaults[0];
  const keyReq = vault?.requirements.find((r) => r.type === "ITEM" && /key/i.test(r.label)) ?? vault?.requirements[0];
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-3">
      <div className="px-4 pt-3">
        {sp.welcome && (
          <div className="mb-3 rounded-2xl bg-brand-soft p-3 text-sm text-primary">
            <strong>Welcome to LootBox, {firstName}!</strong> Start with your free daily check-in and spin below.
          </div>
        )}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{greeting(new Date(), tz)} 👋</p>
            <h1 className="text-2xl font-bold">{firstName}</h1>
          </div>
          <Link href="/app/daily" className="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-bold text-orange-700">
            <Flame className="size-4" aria-hidden />
            {daily.streak.current} day streak
          </Link>
        </div>
      </div>

      <div className="px-4">
        <WalletSummary balances={balances} />
      </div>

      {banners.map((b) => (
        <div key={b.id} className="px-4">
          <div className="rounded-2xl border border-gold/40 bg-gold-soft p-3 text-sm">
            <p className="font-semibold text-gold-foreground">{b.title}</p>
            {b.body && <p className="text-muted-foreground">{b.body}</p>}
            {b.link && (
              <Link href={b.link} className="mt-1 inline-block text-xs font-semibold text-primary underline">
                Learn more
              </Link>
            )}
          </div>
        </div>
      ))}

      <Section title="Today" action={<Link href="/app/daily" className="text-xs font-semibold text-primary">See all</Link>}>
        <div className="space-y-2">
          <CheckInCard claimed={daily.loginClaimed} streak={daily.streak.current} />
          <TodayRow
            href="/app/daily#spin"
            icon="🎡"
            title="Daily Spin"
            meta={daily.spin ? `You won ${daily.spin.display}` : "One free spin every day"}
            done={Boolean(daily.spin)}
            cta={daily.spinAvailable ? "Spin" : undefined}
          />
          <TodayRow
            href="/app/daily#missions"
            icon="🎯"
            title="Daily Missions"
            meta={daily.bonusClaimed ? "All rewards claimed" : `${daily.missionsDone}/${daily.missions.length} complete`}
            done={daily.bonusClaimed}
          />
          {daily.event && (
            <TodayRow
              href="/app/daily#event"
              icon={daily.event.icon}
              title={daily.event.title}
              meta={daily.eventClaim ? `Found ${daily.eventClaim.display}` : "Today's mystery event"}
              done={Boolean(daily.eventClaim)}
            />
          )}
        </div>
      </Section>

      <Section title="Your progress">
        <div className="grid grid-cols-2 gap-2">
          {map && (
            <Link href="/app/play/map" className="rounded-2xl border bg-card p-3 hover:bg-surface">
              <p className="text-xs text-muted-foreground">🗺️ Map progress</p>
              <p className="font-heading text-xl font-bold tabular">
                {map.discovered}/{map.totalTiles}
              </p>
              <Progress value={(map.discovered / Math.max(1, map.totalTiles)) * 100} className="mt-2 h-1.5" indicatorClassName="bg-emerald-500" aria-label="Map progress" />
            </Link>
          )}
          {vault && (
            <Link href="/app/play/vault" className="rounded-2xl border bg-card p-3 hover:bg-surface">
              <p className="truncate text-xs text-muted-foreground">
                {vault.icon} {vault.unlocked ? vault.name : keyReq?.label ?? vault.name}
              </p>
              <p className="font-heading text-xl font-bold tabular">
                {vault.unlocked ? "Opened" : keyReq ? `${Math.min(keyReq.current, keyReq.required)}/${keyReq.required}` : `${vault.progress}%`}
              </p>
              <Progress
                value={vault.unlocked ? 100 : keyReq ? (Math.min(keyReq.current, keyReq.required) / keyReq.required) * 100 : vault.progress}
                className="mt-2 h-1.5"
                indicatorClassName="bg-amber-500"
                aria-label="Vault progress"
              />
            </Link>
          )}
        </div>
      </Section>

      <Section>
        <TomorrowTeaser title={daily.teaser.title} text={daily.teaser.text} />
      </Section>

      <Section title="Play">
        <div className="space-y-2">
          <GameCard href="/app/play/mystery-box" theme="box" title="Mystery Box" description="Pick 1 of 9 boxes and reveal your prize" size="compact" />
          <GameCard
            href="/app/play/map"
            theme="map"
            title="Mystery Map"
            description="Explore Lost Island tile by tile"
            meta={daily.freeDiscoveriesLeft > 0 ? `${daily.freeDiscoveriesLeft} free discoveries today` : undefined}
            size="compact"
          />
          <GameCard href="/app/play/vault" theme="vault" title="Vault" description="Gather keys and fragments to open it" size="compact" />
        </div>
      </Section>
    </div>
  );
}
