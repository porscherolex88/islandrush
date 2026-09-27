import { CalendarCheck, ChevronRight, Coins, Flame, KeyRound, Map as MapIcon, Target, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { ArtCard, ArtChip, ART, StatRow } from "@/components/app/art";
import { CheckInCard } from "@/components/app/daily-actions";
import { TomorrowTeaser } from "@/components/app/daily-cards";
import { Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";
import { formatCredits, formatMYR } from "@/lib/money";
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
  const special = map?.areas.find((a) => a.isSpecial && !a.accessible);
  const showMystery = Boolean(daily.event && !daily.eventClaim);

  return (
    <div className="space-y-1 pb-2">
      <div className="px-4 pt-2">
        {sp.welcome && (
          <div className="mb-3 rounded-2xl bg-brand-soft p-3 text-sm text-primary">
            <strong>Welcome to LootBox, {firstName}!</strong> Start with your free daily check-in and spin below.
          </div>
        )}
        <h1 className="text-2xl font-bold">
          {greeting(new Date(), tz)}, {firstName} <span aria-hidden>👋</span>
        </h1>
        <Link href="/app/daily" className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-orange-100 px-3.5 text-sm font-bold text-orange-700">
          <Flame className="size-4" aria-hidden />
          {daily.streak.current} Day Streak
        </Link>
      </div>

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
        ) : special ? (
          <ArtCard
            href="/app/play/map"
            art={ART.temple}
            eyebrow="Your next goal"
            title={`The ${special.name} is waiting`}
            chips={special.requirements.map((r) => (
              <ArtChip key={r.id} done={r.met}>
                {r.label} {r.met ? "✓" : `${Math.min(r.current, r.required)}/${r.required}`}
              </ArtChip>
            ))}
            cta="Continue exploring"
            tall
            priority
          />
        ) : (
          <ArtCard href="/app/play/vault" art={ART.vault} eyebrow="Your next goal" title={vault?.name ?? "The Vault"} body={vault?.unlocked ? "You opened it. Well done, explorer." : "Gather keys and seal fragments to open it."} cta="View Vault" tall priority />
        )}
      </Section>

      <Section title="Your rewards" action={<Link href="/app/wallet" className="flex h-11 items-center text-sm font-semibold text-primary">Wallet</Link>}>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/app/wallet/withdraw" className="rounded-2xl border bg-card p-4 shadow-card hover:bg-surface">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Wallet className="size-4 text-success" aria-hidden /> Withdrawable
            </p>
            <p className="mt-1 font-heading text-2xl font-extrabold tabular">{formatMYR(balances.WITHDRAWABLE)}</p>
            <p className="text-xs text-muted-foreground">Money you can withdraw now</p>
          </Link>
          <Link href="/app/wallet/convert" className="rounded-2xl border bg-card p-4 shadow-card hover:bg-surface">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Coins className="size-4 text-gold" aria-hidden /> Credits
            </p>
            <p className="mt-1 font-heading text-2xl font-extrabold tabular">{formatCredits(balances.CREDITS)}</p>
            <p className="text-xs text-muted-foreground">Game credits used to play</p>
          </Link>
        </div>
        {(balances.CASH > 0n || balances.PENDING_REWARDS > 0n) && (
          <Link href="/app/wallet" className="mt-2 flex min-h-11 items-center justify-between rounded-xl bg-surface px-3 text-xs text-muted-foreground">
            <span>
              {balances.CASH > 0n && (
                <>
                  Cash <strong className="text-foreground tabular">{formatMYR(balances.CASH)}</strong> ready to convert
                </>
              )}
              {balances.CASH > 0n && balances.PENDING_REWARDS > 0n && " · "}
              {balances.PENDING_REWARDS > 0n && (
                <>
                  <strong className="text-foreground tabular">{formatMYR(balances.PENDING_REWARDS)}</strong> under review
                </>
              )}
            </span>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </Section>

      {banners.map((b) => (
        <div key={b.id} className="px-4 py-1">
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

      <Section title="Today's progress" action={<Link href="/app/daily" className="flex h-11 items-center text-sm font-semibold text-primary">Daily</Link>}>
        <div className="space-y-2">
          {!daily.loginClaimed && <CheckInCard claimed={daily.loginClaimed} streak={daily.streak.current} />}
          <StatRow href="/app/daily#spin" icon={<CalendarCheck className="size-5" />} label="Daily Spin" value={daily.spin ? "✓" : daily.spinAvailable ? "Free" : "-"} done={Boolean(daily.spin)} />
          <StatRow href="/app/daily#missions" icon={<Target className="size-5" />} label="Missions" value={`${daily.missionsDone}/${daily.missions.length}`} done={daily.bonusClaimed} />
          {map && <StatRow href="/app/play/map" icon={<MapIcon className="size-5" />} label="Map" value={`${map.discovered}/${map.totalTiles}`} done={map.discovered === map.totalTiles} />}
        </div>
      </Section>

      <Section title="Continue your journey">
        <div className="grid grid-cols-2 gap-2">
          {map && (
            <Link href="/app/play/map" className="group relative isolate flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl p-3 text-white shadow-card">
              <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${ART.island})` }} />
              <span aria-hidden className="art-scrim-b absolute inset-0 -z-10" />
              <span className="flex items-center gap-1 text-xs font-semibold text-white/85">
                <MapIcon className="size-3.5" aria-hidden /> Mystery Map
              </span>
              <span className="font-heading text-xl font-extrabold tabular">
                {map.discovered}/{map.totalTiles}
              </span>
              <span className="text-xs text-white/80">{daily.freeDiscoveriesLeft > 0 ? `${daily.freeDiscoveriesLeft} free today` : "tiles discovered"}</span>
            </Link>
          )}
          {vault && (
            <Link href="/app/play/vault" className="group relative isolate flex min-h-36 flex-col justify-end overflow-hidden rounded-2xl p-3 text-white shadow-card">
              <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${ART.vault})` }} />
              <span aria-hidden className="art-scrim-b absolute inset-0 -z-10" />
              <span className="flex items-center gap-1 text-xs font-semibold text-white/85">
                <KeyRound className="size-3.5" aria-hidden /> Vault
              </span>
              <span className="font-heading text-xl font-extrabold tabular">
                {vault.unlocked ? "Opened" : keyReq ? `${Math.min(keyReq.current, keyReq.required)}/${keyReq.required}` : `${vault.progress}%`}
              </span>
              <span className="text-xs text-white/80">{vault.unlocked ? "Well done" : keyReq ? "Keys found" : "complete"}</span>
            </Link>
          )}
        </div>
        <Link href="/app/play/mystery-box" className="group relative isolate mt-2 flex min-h-20 items-center overflow-hidden rounded-2xl px-4 text-white shadow-card">
          <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${ART.boxHub})` }} />
          <span aria-hidden className="art-scrim absolute inset-0 -z-10" />
          <span className="flex-1">
            <span className="block font-heading text-lg font-extrabold">Mystery Box</span>
            <span className="text-xs text-white/85">Choose 1 of 9 crates</span>
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </Section>

      <Section>
        <Link href="/app/referrals" className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 shadow-card hover:bg-surface">
          <span className="grid size-11 place-items-center rounded-xl bg-gold-soft text-gold-foreground">
            <Users className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold">Invite friends</span>
            <span className="text-xs text-muted-foreground">Earn a reward when they make their first deposit</span>
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
