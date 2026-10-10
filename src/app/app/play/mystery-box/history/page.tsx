import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { RewardChip } from "@/components/app/reward-reveal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { playHistory } from "@/server/services/mystery-box";
import type { RewardResult } from "@/server/services/rewards";

export const metadata: Metadata = { title: "Mystery Box History" };

const PAGE = 20;

export default async function BoxHistoryPage({ searchParams }: PageProps<"/app/play/mystery-box/history">) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await playHistory(user.id, PAGE + 1, (page - 1) * PAGE);
  const hasMore = rows.length > PAGE;

  return (
    <div>
      <InnerPageHeader title="Mystery Box History" />
      <Section>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Package className="size-8 text-primary" />}
            title="No boxes opened yet"
            description="Your Mystery Box results will appear here."
            action={
              <Button asChild>
                <Link href="/app/play/mystery-box">Open a box</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {rows.slice(0, PAGE).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.boxName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(r.createdAt)} · {r.level ? `Adventure Level ${r.level}` : `Box ${r.selectedIndex + 1}`} · -{formatCredits(r.creditsSpent)} Credits
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <RewardChip reward={r.reward as unknown as RewardResult} />
                  {(r.loot as unknown as RewardResult[]).map((l, i) => (
                    <RewardChip key={i} reward={l} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {(page > 1 || hasMore) && (
          <div className="mt-3 flex justify-between">
            {page > 1 ? (
              <Button asChild variant="outline">
                <Link href={`?page=${page - 1}`}>Newer</Link>
              </Button>
            ) : (
              <span />
            )}
            {hasMore && (
              <Button asChild variant="outline">
                <Link href={`?page=${page + 1}`}>Older</Link>
              </Button>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
