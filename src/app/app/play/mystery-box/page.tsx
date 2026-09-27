import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { MysteryBoxGrid } from "@/components/app/mystery-box";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/server/services/config";
import { getBalances } from "@/server/services/ledger";
import { boxOdds, listBoxes } from "@/server/services/mystery-box";

export const metadata: Metadata = { title: "Mystery Box" };

export default async function MysteryBoxPage() {
  const user = await requireUser();
  const [boxes, balances, enabled] = await Promise.all([listBoxes(), getBalances(user.id), isFeatureEnabled("mystery_box")]);
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

  return (
    <div>
      <PageHeader
        title="Mystery Box"
        back="/app/play"
        action={
          <Link href="/app/play/mystery-box/history" className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label="Box history">
            <History className="size-5" />
          </Link>
        }
      />
      <Section>
        {!enabled ? (
          <EmptyState icon="🛠️" title="Mystery Box is taking a short break" description="We'll have it back soon. Your Credits are safe." />
        ) : views.length === 0 ? (
          <EmptyState icon="🎁" title="No boxes available right now" description="New Mystery Boxes are on their way." />
        ) : (
          <MysteryBoxGrid boxes={views} credits={Number(balances.CREDITS)} />
        )}
      </Section>
    </div>
  );
}
