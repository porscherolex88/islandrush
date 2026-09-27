import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { TransactionList } from "@/components/app/transaction-list";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { ledgerActivity } from "@/server/queries/wallet";
import type { UserAccountType } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Transactions" };

const FILTERS: { key: string; label: string; account?: UserAccountType }[] = [
  { key: "all", label: "All" },
  { key: "cash", label: "Cash", account: "CASH" },
  { key: "credits", label: "Credits", account: "CREDITS" },
  { key: "pending", label: "Pending", account: "PENDING_REWARDS" },
  { key: "withdrawable", label: "Withdrawable", account: "WITHDRAWABLE" },
  { key: "withdrawals", label: "Withdrawals", account: "WITHDRAWAL_PENDING" },
];
const PAGE = 25;

export default async function TransactionsPage({ searchParams }: PageProps<"/app/wallet/transactions">) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.filter) ?? FILTERS[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, hasMore } = await ledgerActivity(user.id, { account: filter.account, limit: PAGE, offset: (page - 1) * PAGE });
  const href = (p: number) => `?filter=${filter.key}&page=${p}`;

  return (
    <div>
      <PageHeader title="Transactions" back="/app/wallet" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Filter by account">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`?filter=${f.key}`}
            role="tab"
            aria-selected={f.key === filter.key}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold", f.key === filter.key ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <Section>
        {rows.length ? <TransactionList rows={rows} /> : <EmptyState icon="🧾" title="Nothing here yet" description="Transactions for this account will appear here." />}
        {(page > 1 || hasMore) && (
          <div className="mt-3 flex justify-between">
            {page > 1 ? (
              <Button asChild variant="outline">
                <Link href={href(page - 1)}>Newer</Link>
              </Button>
            ) : (
              <span />
            )}
            {hasMore && (
              <Button asChild variant="outline">
                <Link href={href(page + 1)}>Older</Link>
              </Button>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
