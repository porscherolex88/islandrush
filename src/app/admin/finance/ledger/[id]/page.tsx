import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard, AdminPage, DataTable, JsonBlock, KeyValue, UserLink } from "@/components/admin/ui";
import { db } from "@/db";
import { ledgerEntries, ledgerTransactions, profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime } from "@/lib/time";
import { humanize } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Ledger transaction" };

const SOURCE_LINKS: Record<string, (id: string) => string> = {
  deposit: (id) => `/admin/finance/deposits/${id}`,
  withdrawal: (id) => `/admin/finance/withdrawals/${id}`,
};

export default async function LedgerTxPage({ params }: PageProps<"/admin/finance/ledger/[id]">) {
  const fiat = await getFiatDisplay();
  await requireAdmin("finance.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [tx] = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.id, id)).limit(1);
  if (!tx) notFound();
  const [entries, owner, creator, reversedBy, reverses] = await Promise.all([
    db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, id)).orderBy(ledgerEntries.id),
    tx.userId ? db.select({ id: profiles.id, name: profiles.name, email: profiles.email }).from(profiles).where(eq(profiles.id, tx.userId)).limit(1) : Promise.resolve([]),
    tx.createdBy ? db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, tx.createdBy)).limit(1) : Promise.resolve([]),
    db.select({ id: ledgerTransactions.id, type: ledgerTransactions.type }).from(ledgerTransactions).where(eq(ledgerTransactions.reversesId, id)),
    tx.reversesId ? db.select({ id: ledgerTransactions.id, type: ledgerTransactions.type }).from(ledgerTransactions).where(eq(ledgerTransactions.id, tx.reversesId)).limit(1) : Promise.resolve([]),
  ]);
  const sum = entries.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.currency]: (acc[e.currency] ?? 0) + Number(e.amount) }), {});
  const balanced = Object.values(sum).every((v) => Math.abs(v) < 0.005);
  const sourceHref = tx.sourceType && tx.sourceId && SOURCE_LINKS[tx.sourceType]?.(tx.sourceId);

  return (
    <AdminPage title={humanize(tx.type)} description={tx.description}>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <AdminCard title="Entries" description={balanced ? "Balanced: entries sum to zero per currency" : "Unbalanced transaction, investigate immediately"} bodyClassName="p-0">
          <DataTable
            rows={entries}
            rowKey={(r) => String(r.id)}
            columns={[
              { key: "acct", header: "Account", cell: (r) => <code className="text-xs">{r.accountType}</code> },
              { key: "own", header: "Owner", cell: (r) => (r.userId ? "User" : "System") },
              { key: "amt", header: "Amount", align: "right", cell: (r) => (r.currency === "CREDITS" ? `${formatCredits(r.amount, { sign: true })} Cr` : formatCash(r.amount, { currency: fiat, ...{ sign: true } })) },
              { key: "bal", header: "Balance after", align: "right", cell: (r) => (r.balanceAfter === null ? "-" : r.currency === "CREDITS" ? formatCredits(r.balanceAfter) : formatCash(r.balanceAfter, { currency: fiat })) },
            ]}
          />
        </AdminCard>
        <div className="space-y-4">
          <AdminCard title="Details">
            <KeyValue
              cols={1}
              items={[
                ["Transaction ID", <code key="i" className="text-xs">{tx.id}</code>],
                ["Created", formatDateTime(tx.createdAt)],
                ["User", owner[0] ? <UserLink key="u" id={owner[0].id} name={owner[0].name} email={owner[0].email} /> : "System"],
                ["Created by", creator[0]?.name ?? (tx.createdBy ? tx.createdBy : "System")],
                ["Source", tx.sourceType ? (sourceHref ? <Link key="s" href={sourceHref} className="text-primary hover:underline">{tx.sourceType} {tx.sourceId?.slice(0, 8)}</Link> : `${tx.sourceType} ${tx.sourceId ?? ""}`) : "-"],
                ["Reward source", tx.rewardSource ?? "-"],
                ["Idempotency key", <code key="k" className="text-xs break-all">{tx.idempotencyKey}</code>],
                ["Reverses", reverses[0] ? <Link key="r" href={`/admin/finance/ledger/${reverses[0].id}`} className="text-primary hover:underline">{reverses[0].type}</Link> : "-"],
                ["Reversed by", reversedBy.length ? reversedBy.map((r) => <Link key={r.id} href={`/admin/finance/ledger/${r.id}`} className="mr-2 text-primary hover:underline">{r.type}</Link>) : "-"],
              ]}
            />
          </AdminCard>
          <AdminCard title="Metadata">
            <JsonBlock value={tx.metadata} />
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}
