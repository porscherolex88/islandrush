import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Token } from "@/components/app/art";
import { BookItem, CollectionProgress, collectionNoun, UnlockNote } from "@/components/app/collection";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Panel, Section } from "@/components/app/mobile-header";
import { RewardChip } from "@/components/app/reward-reveal";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { getCollectionDetail } from "@/server/queries/collections";
import type { RewardResult } from "@/server/services/rewards";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionDetailPage({ params }: PageProps<"/app/collections/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const data = await getCollectionDetail(user.id, slug);
  if (!data) notFound();
  const { collection, items, completion, prizes, unlocks } = data;
  const owned = items.filter((i) => i.totalAcquired > 0).length;

  return (
    <div>
      <InnerPageHeader title={collection.name} subtitle={`${owned} / ${items.length} collected`} />
      <Section>
        <Panel className="space-y-3 rounded-3xl">
          <div className="flex items-center gap-3">
            <Token icon={collection.icon} rarity="LEGENDARY" size="lg" />
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          </div>
          <CollectionProgress owned={owned} total={items.length} />
          <UnlockNote unlocks={unlocks} total={items.length} noun={collectionNoun(collection.name)} />
          {completion ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-success">Completed on {formatDate(completion.createdAt)}</p>
              <div className="flex flex-wrap gap-1.5">
                {(completion.rewards as RewardResult[]).map((r, i) => (
                  <RewardChip key={i} reward={r} />
                ))}
              </div>
            </div>
          ) : prizes.length > 0 ? (
            <div>
              <p className="text-sm font-semibold">Reward for completing the set</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {prizes.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-xs font-semibold">
                    <Token icon={p.icon} rarity={p.rarity} size="sm" className="size-7 rounded-full text-sm" />
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </Section>
      <Section title="Collection book">
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {items.map((i) => (
            <BookItem key={i.id} item={i} />
          ))}
        </div>
      </Section>
    </div>
  );
}
