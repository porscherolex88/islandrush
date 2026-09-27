import { Gift, History, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { MysteryBoxGrid, type CollectionLookup } from "@/components/app/mystery-box";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { getCollectionsOverview } from "@/server/queries/collections";
import { isFeatureEnabled } from "@/server/services/config";
import { getRate } from "@/server/services/conversion";
import { getBalances } from "@/server/services/ledger";
import { boxOdds, listBoxes } from "@/server/services/mystery-box";

export const metadata: Metadata = { title: "Mystery Box" };

export default async function MysteryBoxPage() {
  const user = await requireUser();
  const [boxes, balances, enabled, rate, cols] = await Promise.all([listBoxes(), getBalances(user.id), isFeatureEnabled("mystery_box"), getRate(), getCollectionsOverview(user.id)]);
  const views = await Promise.all(
    boxes.map(async (b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      priceCredits: b.priceCredits,
      theme: b.theme,
      dailyLimitPerUser: b.dailyLimitPerUser,
      odds: await boxOdds(b.rewardPoolId),
    })),
  );
  const lookup: CollectionLookup = {};
  for (const c of cols.collections) {
    for (const i of c.items) lookup[i.id] = { collection: c.name, owned: c.owned, total: c.total, has: i.totalAcquired > 0 };
  }

  return (
    <div>
      <PageHeader
        title="Mystery Box"
        back="/app/play"
        action={
          <Link href="/app/play/mystery-box/history" className="grid size-11 place-items-center rounded-full hover:bg-muted" aria-label="Box history">
            <History className="size-5" />
          </Link>
        }
      />
      <Section>
        {!enabled ? (
          <EmptyState icon={<Wrench className="size-10 text-primary" />} title="Mystery Box is taking a short break" description="We'll have it back soon. Your Credits are safe." />
        ) : views.length === 0 ? (
          <EmptyState icon={<Gift className="size-10 text-primary" />} title="No crates on the shore right now" description="New Mystery Boxes are on their way." />
        ) : (
          <MysteryBoxGrid boxes={views} credits={Number(balances.CREDITS)} rate={{ cash: Number(rate.cash), credits: rate.creditsNumber }} collections={lookup} />
        )}
      </Section>
    </div>
  );
}
