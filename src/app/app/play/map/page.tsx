import { Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import { AdventureMap } from "@/components/app/adventure/adventure-map";
import { levelParam } from "@/components/app/adventure/tracks";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { CreditsChip, Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { parentRoute } from "@/lib/app-routes";
import { requireUser } from "@/lib/auth/session";
import { getAdventureState } from "@/server/services/adventure";
import { isFeatureEnabled } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Adventure Map" };

export default async function MapPage({ searchParams }: PageProps<"/app/play/map">) {
  const user = await requireUser();
  const [s, balances, enabled, sp] = await Promise.all([getAdventureState(user.id), getBalances(user.id), isFeatureEnabled("mystery_map"), searchParams]);
  const level = levelParam(sp.level, s.currentMap?.level ?? 1, s.maps.length);
  const map = s.maps.find((m) => m.level === level) ?? null;
  const next = s.maps.find((m) => m.level === level + 1) ?? null;

  if (!enabled || !map) {
    return (
      <div>
        <InnerPageHeader title="Adventure Map" />
        <Section>
          <EmptyState icon={<MapIcon className="size-10 text-primary" />} title={enabled ? "The map is being drawn" : "The map is taking a short break"} description="Check back soon to start exploring." />
        </Section>
      </div>
    );
  }

  return (
    <AdventureMap
      key={map.id}
      map={map}
      enabled={enabled}
      nextMap={next ? { level: next.level, name: next.name } : null}
      prevLevel={s.maps.findLast((m) => m.level < level)?.level ?? null}
      nextLevel={next?.level ?? null}
      levels={s.maps.length}
      backHref={parentRoute("/app/play/map")}
      action={<CreditsChip credits={balances.CREDITS} />}
    />
  );
}
