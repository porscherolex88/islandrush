import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { VaultCard, type VaultView } from "@/components/app/vault-card";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/server/services/config";
import { poolOdds } from "@/server/services/mystery-box";
import type { RewardResult } from "@/server/services/rewards";
import { getVaultStates } from "@/server/services/vault";

export const metadata: Metadata = { title: "Vault" };

export default async function VaultPage() {
  const user = await requireUser();
  const [vaults, enabled] = await Promise.all([getVaultStates(user.id), isFeatureEnabled("vault")]);
  const views: VaultView[] = await Promise.all(
    vaults.map(async (v) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      icon: v.icon,
      unlocked: v.unlocked,
      unlockedAt: v.unlock?.createdAt.toISOString() ?? null,
      unlockRewards: (v.unlock?.rewards ?? []) as RewardResult[],
      ready: v.ready,
      progress: v.progress,
      requirements: v.requirements.map((r) => ({ id: r.id, label: r.label, icon: r.icon, current: r.current, required: r.required, met: r.met, consume: r.consume })),
      prizes: v.rewardPoolId ? (await poolOdds(v.rewardPoolId)).map((o) => ({ id: o.id, label: o.label, icon: o.icon })) : [],
    })),
  );

  return (
    <div>
      <PageHeader title="Vault" subtitle="Gather keys, seals and relics from the map and boxes" back="/app/play" />
      <Section>
        {!enabled ? (
          <EmptyState icon="🏛️" title="The Vault is closed for maintenance" description="Your keys and fragments are safe in your inventory." />
        ) : views.length === 0 ? (
          <EmptyState icon="🏛️" title="No Vaults yet" description="A Vault will appear here soon." />
        ) : (
          <div className="space-y-4">
            {views.map((v) => (
              <VaultCard key={v.id} vault={v} />
            ))}
          </div>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Find Vault Keys in Mystery Boxes and Seal Fragments on the{" "}
          <Link href="/app/play/map" className="font-semibold text-primary underline">
            Mystery Map
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
