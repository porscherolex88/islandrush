import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { CollectionCard, InventoryItem } from "@/components/app/collection";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
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
      <InnerPageHeader title="Collections" subtitle="Your collection book" />
      <Section>
        {collections.length === 0 ? (
          <EmptyState icon={<BookOpen className="size-10 text-primary" />} title="Your collection book is empty" description="Collections appear here as new adventures open." />
        ) : (
          <div className="space-y-3">
            {collections.map((c) => (
              <CollectionCard key={c.id} slug={c.slug} name={c.name} description={c.description} icon={c.icon} owned={c.owned} total={c.total} completed={Boolean(c.completedAt)} items={c.items} unlocks={c.unlocks} />
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

      <Section title="Keys and special items">
        {specials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No special items yet.</p>
        ) : (
          <div className="space-y-2">
            {(ownedSpecials.length ? ownedSpecials : specials).map((i) => (
              <InventoryItem key={i.id} item={i} />
            ))}
            {ownedSpecials.length > 0 && ownedSpecials.length < specials.length && (
              <details className="rounded-2xl border bg-card">
                <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">Still to find ({specials.length - ownedSpecials.length})</summary>
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
