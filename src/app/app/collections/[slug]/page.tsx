import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionProgress, InventoryItem } from "@/components/app/collection";
import { PageHeader, Panel, Section } from "@/components/app/mobile-header";
import { RewardChip } from "@/components/app/reward-reveal";
import { requireUser } from "@/lib/auth/session";
import { rarityOf } from "@/lib/rarity";
import { formatDate } from "@/lib/time";
import { getCollectionDetail } from "@/server/queries/collections";
import type { RewardResult } from "@/server/services/rewards";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionDetailPage({ params }: PageProps<"/app/collections/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const data = await getCollectionDetail(user.id, slug);
  if (!data) notFound();
  const { collection, items, completion, prizes } = data;
  const owned = items.filter((i) => i.totalAcquired > 0).length;

  return (
    <div>
      <PageHeader title={`${collection.icon} ${collection.name}`} subtitle={collection.description} back="/app/collections" />
      <Section>
        <Panel>
          <CollectionProgress owned={owned} total={items.length} />
          {completion ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-semibold text-success">Completed on {formatDate(completion.createdAt)}</p>
              <div className="flex flex-wrap gap-1.5">
                {(completion.rewards as RewardResult[]).map((r, i) => (
                  <RewardChip key={i} reward={r} />
                ))}
              </div>
            </div>
          ) : prizes.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Completion reward</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {prizes.map((p) => (
                  <li key={p.id} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${rarityOf(p.rarity).bg} ${rarityOf(p.rarity).text}`}>
                    <span aria-hidden>{p.icon}</span>
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </Section>
      <Section title="Items">
        <div className="space-y-2">
          {items.map((i) => (
            <InventoryItem key={i.id} item={i} />
          ))}
        </div>
      </Section>
    </div>
  );
}
