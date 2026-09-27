import type { Metadata } from "next";
import Link from "next/link";
import { GameCard } from "@/components/app/game-card";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { getAllFlags } from "@/server/services/config";
import { getDailyState } from "@/server/services/daily";
import { getMapState } from "@/server/services/map";
import { listBoxes } from "@/server/services/mystery-box";
import { getVaultStates } from "@/server/services/vault";

export const metadata: Metadata = { title: "Play" };

export default async function PlayPage() {
  const user = await requireUser();
  const [boxes, map, vaults, daily, flags] = await Promise.all([
    listBoxes(),
    getMapState(user.id),
    getVaultStates(user.id),
    getDailyState(user.id),
    getAllFlags(),
  ]);
  const cheapest = boxes.reduce<number | null>((m, b) => (m === null || b.priceCredits < m ? b.priceCredits : m), null);
  const vault = vaults[0];
  const off = (k: string) => flags[k] === false;

  return (
    <div>
      <PageHeader title="Play" subtitle="Three ways to discover rewards" />
      <Section>
        <div className="space-y-3">
          <GameCard
            href="/app/play/mystery-box"
            theme="box"
            title="Mystery Box"
            description={off("mystery_box") ? "Temporarily unavailable" : "Choose 1 of 9 boxes. Every box hides a prize."}
            meta={cheapest ? `From ${formatCredits(cheapest)} Credits` : undefined}
          />
          <GameCard
            href="/app/play/map"
            theme="map"
            title="Mystery Map"
            description={off("mystery_map") ? "Temporarily unavailable" : "Discover tiles, find fragments and unlock Special Areas."}
            meta={map ? `${map.discovered}/${map.totalTiles} tiles discovered · ${daily.freeDiscoveriesLeft} free today` : undefined}
          />
          <GameCard
            href="/app/play/vault"
            theme="vault"
            title="Vault"
            description={off("vault") ? "Temporarily unavailable" : "Collect keys, seals and relics to open the Vault."}
            meta={vault ? (vault.unlocked ? `${vault.name} opened` : `${vault.progress}% of requirements met`) : undefined}
          />
        </div>
      </Section>
      <Section title="More">
        <div className="grid grid-cols-2 gap-2">
          <Link href="/app/collections" className="rounded-2xl border bg-card p-4 hover:bg-surface">
            <p className="text-2xl" aria-hidden>
              🏺
            </p>
            <p className="mt-1 font-semibold">Collections</p>
            <p className="text-xs text-muted-foreground">Items, fragments and sets</p>
          </Link>
          <Link href="/app/play/mystery-box/history" className="rounded-2xl border bg-card p-4 hover:bg-surface">
            <p className="text-2xl" aria-hidden>
              📜
            </p>
            <p className="mt-1 font-semibold">Box history</p>
            <p className="text-xs text-muted-foreground">Every box you&apos;ve opened</p>
          </Link>
        </div>
      </Section>
    </div>
  );
}
