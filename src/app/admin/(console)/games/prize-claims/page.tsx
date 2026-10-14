import { and, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/actions";
import { AdminPage, DataTable, FilterBar, FilterSelect, Pagination, StatGrid, StatsCard, UserLink, pageOf, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { prizeClaims, profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { updatePrizeClaimStatusAction } from "@/server/actions/admin/ops";
import { CLAIM_TRANSITIONS } from "@/server/services/adventure";

export const metadata: Metadata = { title: "Prize claims" };
const PAGE = 50;
const STATUSES = ["UNLOCKED", "CLAIM_PENDING", "UNDER_REVIEW", "APPROVED", "FULFILLING", "FULFILLED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

const ACTION_LABEL: Partial<Record<Status, string>> = {
  UNDER_REVIEW: "Review",
  APPROVED: "Approve",
  FULFILLING: "Fulfilling",
  FULFILLED: "Fulfilled",
  REJECTED: "Reject",
};

export default async function PrizeClaimsPage({ searchParams }: PageProps<"/admin/games/prize-claims">) {
  await requireAdmin("games.manage");
  const sp = await searchParams;
  const page = pageOf(sp);
  const status = str(sp.status);
  const filter = status && STATUSES.includes(status as Status) ? eq(prizeClaims.status, status as Status) : undefined;

  const [list, counts] = await Promise.all([
    db
      .select({ claim: prizeClaims, name: profiles.name, email: profiles.email })
      .from(prizeClaims)
      .innerJoin(profiles, eq(profiles.id, prizeClaims.userId))
      .where(and(filter))
      .orderBy(desc(prizeClaims.createdAt))
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE),
    db.select({ status: prizeClaims.status, n: sql<number>`count(*)::int` }).from(prizeClaims).groupBy(prizeClaims.status),
  ]);
  const count = (s: Status) => Number(counts.find((c) => c.status === s)?.n ?? 0);
  const shown = list.slice(0, PAGE);

  return (
    <AdminPage
      title="Prize claims"
      description="Prizes unlocked through the Final Prize Unlock. Credits and Cash prizes are paid automatically when claimed. Physical prizes need review and fulfilment here. Rejecting a claim returns the prize to inventory."
    >
      <StatGrid cols={4}>
        <StatsCard label="Waiting for player" value={count("UNLOCKED")} href="/admin/games/prize-claims?status=UNLOCKED" />
        <StatsCard label="Needs review" value={count("CLAIM_PENDING") + count("UNDER_REVIEW")} tone={count("CLAIM_PENDING") ? "warning" : "default"} href="/admin/games/prize-claims?status=CLAIM_PENDING" />
        <StatsCard label="Being fulfilled" value={count("APPROVED") + count("FULFILLING")} href="/admin/games/prize-claims?status=APPROVED" />
        <StatsCard label="Fulfilled" value={count("FULFILLED")} tone="success" href="/admin/games/prize-claims?status=FULFILLED" />
      </StatGrid>
      <FilterBar basePath="/admin/games/prize-claims">
        <FilterSelect name="status" label="Status" value={status} options={STATUSES} />
      </FilterBar>
      <DataTable
        rows={shown}
        rowKey={(r) => r.claim.id}
        empty="No prize claims match"
        columns={[
          { key: "t", header: "Unlocked", cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.claim.createdAt)}</span> },
          { key: "u", header: "Player", cell: (r) => <UserLink id={r.claim.userId} name={r.name} email={r.email} /> },
          {
            key: "p",
            header: "Prize",
            cell: (r) => {
              const snap = r.claim.prizeSnapshot as { name?: string; kind?: string };
              return (
                <div>
                  <p className="font-medium">{snap.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Level {r.claim.level} · {String(snap.kind ?? "").toLowerCase()}
                  </p>
                </div>
              );
            },
          },
          {
            key: "c",
            header: "Delivery details",
            cell: (r) => {
              const c = r.claim.contact as { fullName?: string; phone?: string; address?: string; note?: string };
              if (!c.fullName) return <span className="text-xs text-muted-foreground">-</span>;
              return (
                <div className="max-w-64 text-xs">
                  <p className="font-medium">{c.fullName}</p>
                  <p>{c.phone}</p>
                  <p className="whitespace-pre-line text-muted-foreground">{c.address}</p>
                  {c.note && <p className="mt-1 italic text-muted-foreground">{c.note}</p>}
                </div>
              );
            },
          },
          {
            key: "s",
            header: "Status",
            cell: (r) => (
              <div>
                <StatusBadge status={r.claim.status} />
                {r.claim.reviewNote && <p className="mt-0.5 max-w-48 text-xs text-muted-foreground">{r.claim.reviewNote}</p>}
              </div>
            ),
          },
          {
            key: "x",
            header: "",
            cell: (r) => (
              <div className="flex flex-wrap justify-end gap-1">
                {(CLAIM_TRANSITIONS[r.claim.status] ?? []).map((next) => (
                  <ActionButton
                    key={next}
                    action={updatePrizeClaimStatusAction}
                    args={[r.claim.id, next]}
                    variant={next === "REJECTED" ? undefined : "outline"}
                    success="Claim updated"
                    confirm={{
                      title: `${ACTION_LABEL[next]} this claim?`,
                      description: next === "REJECTED" ? "The player is notified and the prize returns to inventory. This cannot be undone." : "The player is notified of the new status.",
                      reasonLabel: next === "REJECTED" ? "Reason (shared with the player's record)" : "Note (optional)",
                      reasonRequired: next === "REJECTED",
                      destructive: next === "REJECTED",
                      confirmLabel: ACTION_LABEL[next],
                    }}
                  >
                    {ACTION_LABEL[next]}
                  </ActionButton>
                ))}
              </div>
            ),
          },
        ]}
      />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/games/prize-claims" />
    </AdminPage>
  );
}
