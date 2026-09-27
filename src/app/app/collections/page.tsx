import type { Metadata } from "next";
import { CollectionCard, InventoryItem } from "@/components/app/collection";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { getCollectionsOverview } from "@/server/queries/collections";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const user = await requireUser();
  const { collections, specials, fragments } = await getCollectionsOverview(user.id);
  const ownedSpecials = specials.filter((i) => i.totalAcquired > 0 || i.quantity > 0);

  return (
    <div>
      <PageHeader title="Collections" subtitle="Complete sets to earn completion rewards" back="/app/progress" />
      <Section>
        {collections.length === 0 ? (
          <EmptyState icon="🏺" title="No collections yet" />
        ) : (
          <div className="space-y-3">
            {collections.map((c) => (
              <CollectionCard key={c.id} {...c} completed={Boolean(c.completedAt)} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Fragments">
        {fragments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fragments in play.</p>
        ) : (
          <div className="space-y-2">
            {fragments.map((i) => (
              <InventoryItem key={i.id} item={i} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Special Items and Keys">
        {specials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No special items yet.</p>
        ) : (
          <div className="space-y-2">
            {(ownedSpecials.length ? ownedSpecials : specials).map((i) => (
              <InventoryItem key={i.id} item={i} />
            ))}
            {ownedSpecials.length > 0 && ownedSpecials.length < specials.length && (
              <details className="rounded-2xl border bg-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Still to find ({specials.length - ownedSpecials.length})</summary>
                <div className="space-y-2 p-3 pt-0">
                  {specials
                    .filter((i) => !ownedSpecials.includes(i))
                    .map((i) => (
                      <InventoryItem key={i.id} item={i} />
                    ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
