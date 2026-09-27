import { BookOpen, ChevronRight, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArtCard, ArtChip, ART } from "@/components/app/art";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { getAllFlags } from "@/server/services/config";
import { getDailyState } from "@/server/services/daily";
import { getMapState } from "@/server/services/map";
import { listBoxes } from "@/server/services/mystery-box";
import { getVaultStates } from "@/server/services/vault";

export const metadata: Metadata = { title: "Play" };

export default async function PlayPage() {
  const user = await requireUser();
  const [boxes, map, vaults, daily, flags] = await Promise.all([
    listBoxes(),
    getMapState(user.id),
    getVaultStates(user.id),
    getDailyState(user.id),
    getAllFlags(),
  ]);
  const cheapest = boxes.reduce<number | null>((m, b) => (m === null || b.priceCredits < m ? b.priceCredits : m), null);
  const vault = vaults[0];
  const keyReq = vault?.requirements.find((r) => r.type === "ITEM" && /key/i.test(r.label));
  const off = (k: string) => flags[k] === false;

  return (
    <div>
      <PageHeader title="Play" subtitle="Explore, discover, collect and unlock" />
      <Section className="space-y-3">
        <ArtCard
          href="/app/play/mystery-box"
          art={ART.boxHub}
          eyebrow="Mystery Box"
          title="Choose 1 of 9"
          body={off("mystery_box") ? "Taking a short break" : "Nine sealed crates washed ashore."}
          chips={cheapest ? <ArtChip>From {formatCredits(cheapest)} Credits</ArtChip> : undefined}
          cta="Open a Box"
          tall
          priority
        />
        <ArtCard
          href="/app/play/map"
          art={ART.island}
          eyebrow="Mystery Map"
          title={map?.map.name ?? "Lost Island"}
          body={off("mystery_map") ? "Taking a short break" : map ? `${map.discovered} / ${map.totalTiles} discovered` : "Being drawn"}
          chips={daily.freeDiscoveriesLeft > 0 ? <ArtChip>{daily.freeDiscoveriesLeft} free discoveries today</ArtChip> : undefined}
          cta="Explore Island"
          tall
          className="[&_img]:object-[center_70%]"
        />
        <ArtCard
          href="/app/play/vault"
          art={ART.vault}
          eyebrow="Vault"
          title={vault?.name ?? "Ancient Vault"}
          body={off("vault") ? "Taking a short break" : vault?.unlocked ? "Opened" : vault?.ready ? "Ready to open!" : keyReq ? `${Math.min(keyReq.current, keyReq.required)} / ${keyReq.required} Keys` : `${vault?.progress ?? 0}% ready`}
          cta="View Vault"
          tall
        />
      </Section>
      <Section title="More">
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/app/collections", icon: BookOpen, title: "Collections", text: "Your collection book" },
            { href: "/app/play/mystery-box/history", icon: History, title: "Box history", text: "Every box you've opened" },
          ].map(({ href, icon: Icon, title, text }) => (
            <Link key={href} href={href} className="flex min-h-24 flex-col justify-between rounded-2xl border bg-card p-4 shadow-card hover:bg-surface">
              <span className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-xs text-muted-foreground">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
