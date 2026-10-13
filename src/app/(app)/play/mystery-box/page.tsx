import { Gift, History, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BoxPath } from "@/components/app/adventure/box-path";
import { BoxShop } from "@/components/app/adventure/box-shop";
import { affordableBox, boxTrack, levelParam } from "@/components/app/adventure/tracks";
import { boxArt } from "@/components/app/art";
import { headerIconButton } from "@/components/app/header-buttons";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { CreditsChip, Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import {
  adventureBoxPrizes,
  getAdventureState,
} from "@/server/services/adventure";
import { isFeatureEnabled } from "@/server/services/config";
import { getRate } from "@/server/services/conversion";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Mystery Box" };

export default async function MysteryBoxPage({
  searchParams,
}: PageProps<"/play/mystery-box">) {
  const user = await requireUser();
  const [s, balances, enabled, sp, rate] = await Promise.all([
    getAdventureState(user.id),
    getBalances(user.id),
    isFeatureEnabled("mystery_box"),
    searchParams,
    getRate(),
  ]);
  const level = levelParam(sp.level, affordableBox(s, Number(balances.CREDITS))?.level ?? 1, s.boxes.length);
  const box = s.boxes.find((b) => b.level === level) ?? null;
  const map = s.maps.find((m) => m.level === level) ?? null;
  const prizes = box ? await adventureBoxPrizes(box.id) : { rewards: [], loot: [] };

  return (
    <div className="flex h-dvh flex-col overflow-hidden desktop:h-full">
      <InnerPageHeader
        title="Mystery Box"
        subtitle={
          box ? `Adventure Level ${box.level} of ${s.boxes.length}` : undefined
        }
        action={
          <>
            <Link
              href="/play/mystery-box/history"
              className={headerIconButton}
              aria-label="Mystery Box History"
            >
              <History className="size-[18px]" aria-hidden />
            </Link>
            <CreditsChip credits={balances.CREDITS} />
          </>
        }
      />
      {!enabled ? (
        <Section>
          <EmptyState
            icon={<Wrench className="size-10 text-primary" />}
            title="Mystery Box is taking a short break"
            description="We'll have it back soon. Your Credits are safe."
          />
        </Section>
      ) : !box ? (
        <Section>
          <EmptyState
            icon={<Gift className="size-10 text-primary" />}
            title="No Mystery Boxes right now"
            description="New Mystery Boxes are on their way."
          />
        </Section>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-5">
          <BoxPath
            active={box.level}
            stops={boxTrack(s).map((t) => {
              const b = s.boxes.find((x) => x.level === t.level)!;
              return {
                level: t.level,
                state: t.state,
                name: b.name,
                art: boxArt(b.level, b.artwork),
              };
            })}
          />
          <BoxShop
            key={box.id}
            className="flex-1"
            box={box}
            map={map}
            credits={Number(balances.CREDITS)}
            cashMinor={balances.CASH.toString()}
            rate={{
              cashMinor: rate.cashMinor.toString(),
              credits: rate.creditsNumber,
            }}
            prizes={prizes}
            enabled={enabled}
          />
        </div>
      )}
    </div>
  );
}
