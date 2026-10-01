import { Gift, History, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BoxShop } from "@/components/app/adventure/box-shop";
import { LevelTrack } from "@/components/app/adventure/level-track";
import { boxTrack, levelParam } from "@/components/app/adventure/tracks";
import { headerIconButton } from "@/components/app/header-buttons";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { CreditsChip, Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { adventureBoxOdds, getAdventureState } from "@/server/services/adventure";
import { isFeatureEnabled } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Mystery Box" };

export default async function MysteryBoxPage({ searchParams }: PageProps<"/app/play/mystery-box">) {
  const user = await requireUser();
  const [s, balances, enabled, sp] = await Promise.all([getAdventureState(user.id), getBalances(user.id), isFeatureEnabled("mystery_box"), searchParams]);
  const level = levelParam(sp.level, s.currentBox?.level ?? 1, s.boxes.length);
  const box = s.boxes.find((b) => b.level === level) ?? null;
  const map = s.maps.find((m) => m.level === level) ?? null;
  const odds = box ? await adventureBoxOdds(box.id) : { rewards: [], loot: [] };

  return (
    <div>
      <InnerPageHeader
        title="Mystery Box"
        subtitle={box ? `Level ${box.level} of ${s.boxes.length}` : undefined}
        action={
          <>
            <Link href="/app/play/mystery-box/history" className={headerIconButton} aria-label="Mystery Box History">
              <History className="size-[18px]" aria-hidden />
            </Link>
            <CreditsChip credits={balances.CREDITS} />
          </>
        }
      />
      {!enabled ? (
        <Section>
          <EmptyState icon={<Wrench className="size-10 text-primary" />} title="Mystery Box is taking a short break" description="We'll have it back soon. Your Credits are safe." />
        </Section>
      ) : !box ? (
        <Section>
          <EmptyState icon={<Gift className="size-10 text-primary" />} title="No Mystery Boxes right now" description="New Mystery Boxes are on their way." />
        </Section>
      ) : (
        <>
          <Section>
            <LevelTrack levels={boxTrack(s)} active={box.level} hrefFor={(l) => `/app/play/mystery-box?level=${l}`} label="Mystery Box levels" />
          </Section>
          <Section>
            <BoxShop key={box.id} box={box} map={map} credits={Number(balances.CREDITS)} odds={odds} enabled={enabled} />
          </Section>
        </>
      )}
    </div>
  );
}
