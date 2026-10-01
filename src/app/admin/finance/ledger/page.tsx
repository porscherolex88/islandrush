import { and, desc, eq, gte, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, UserLink, pageOf, str, type Column } from "@/components/admin/ui";
import { db } from "@/db";
import { accountTypeEnum, ledgerEntries, ledgerTransactions, ledgerTxTypeEnum, profiles, rewardSourceEnum } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime } from "@/lib/time";
import { humanize } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Ledger" };
const PAGE = 100;
const UUID = /^[0-9a-f-]{36}$/i;

export default async function LedgerPage({ searchParams }: PageProps<"/admin/finance/ledger">) {
  const fiat = await getFiatDisplay();
  await requireAdmin("finance.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const conds: SQL[] = [];
  const user = str(sp.user)?.trim();
  if (user) conds.push(user.includes("@") ? sql`${ledgerEntries.userId} = (select id from profiles where email = ${user.toLowerCase()})` : eq(ledgerEntries.userId, user));
  const account = str(sp.account);
  if (account && (accountTypeEnum.enumValues as readonly string[]).includes(account)) conds.push(eq(ledgerEntries.accountType, account as "CASH"));
  const type = str(sp.type);
  if (type && (ledgerTxTypeEnum.enumValues as readonly string[]).includes(type)) conds.push(eq(ledgerTransactions.type, type as "DEPOSIT"));
  const source = str(sp.source);
  if (source && (rewardSourceEnum.enumValues as readonly string[]).includes(source)) conds.push(eq(ledgerTransactions.rewardSource, source as "GAME_REWARD"));
  if (str(sp.status) === "reversal") conds.push(isNotNull(ledgerTransactions.reversesId));
  const from = str(sp.from);
  if (from) conds.push(gte(ledgerEntries.createdAt, new Date(`${from}T00:00:00+08:00`)));
  const to = str(sp.to);
  if (to) conds.push(lte(ledgerEntries.createdAt, new Date(`${to}T23:59:59+08:00`)));
  const min = str(sp.min);
  if (min && /^\d+(\.\d+)?$/.test(min)) conds.push(sql`abs(${ledgerEntries.amount}) >= ${min}`);
  const max = str(sp.max);
  if (max && /^\d+(\.\d+)?$/.test(max)) conds.push(sql`abs(${ledgerEntries.amount}) <= ${max}`);
  const ref = str(sp.ref)?.trim();
  if (ref) conds.push(or(UUID.test(ref) ? eq(ledgerTransactions.id, ref) : sql`false`, eq(ledgerTransactions.sourceId, ref), eq(ledgerTransactions.idempotencyKey, ref))!);

  const list = await db
    .select({
      id: ledgerEntries.id,
      createdAt: ledgerEntries.createdAt,
      account: ledgerEntries.accountType,
      currency: ledgerEntries.currency,
      amount: ledgerEntries.amount,
      balanceAfter: ledgerEntries.balanceAfter,
      userId: ledgerEntries.userId,
      name: profiles.name,
      email: profiles.email,
      txId: ledgerTransactions.id,
      type: ledgerTransactions.type,
      description: ledgerTransactions.description,
      sourceType: ledgerTransactions.sourceType,
      rewardSource: ledgerTransactions.rewardSource,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerTransactions, eq(ledgerTransactions.id, ledgerEntries.transactionId))
    .leftJoin(profiles, eq(profiles.id, ledgerEntries.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(ledgerEntries.id))
    .limit(PAGE + 1)
    .offset((page - 1) * PAGE);
  const rows = list.slice(0, PAGE);
  type Row = (typeof rows)[number];
  const money = (r: Row, v: string, sign = false) => (r.currency === "CREDITS" ? `${formatCredits(v, { sign })} Cr` : formatCash(v, { currency: fiat, ...{ sign } }));
  const columns: Column<Row>[] = [
    { key: "id", header: "#", cell: (r) => <span className="text-xs text-muted-foreground tabular">{r.id}</span> },
    { key: "at", header: "When", cell: (r) => <span className="text-xs whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
    { key: "tx", header: "Transaction", cell: (r) => <Link href={`/admin/finance/ledger/${r.txId}`} className="font-medium text-primary hover:underline">{humanize(r.type)}</Link> },
    { key: "acct", header: "Account", cell: (r) => <code className="text-xs">{r.account}</code> },
    { key: "user", header: "Owner", cell: (r) => (r.userId ? <UserLink id={r.userId} name={r.name} email={r.email} /> : <span className="text-xs text-muted-foreground">System</span>) },
    { key: "desc", header: "Description", cell: (r) => <span className="line-clamp-1 text-xs">{r.description}</span> },
    { key: "amt", header: "Amount", align: "right", cell: (r) => <span className={Number(r.amount) < 0 ? "text-red-700" : "text-emerald-700"}>{money(r, r.amount, true)}</span> },
    { key: "bal", header: "Balance after", align: "right", cell: (r) => (r.balanceAfter === null ? "-" : money(r, r.balanceAfter)) },
  ];
  return (
    <AdminPage title="Ledger" description="Every balance movement as double-entry lines. Entries are append-only and cannot be edited.">
      <FilterBar basePath="/admin/finance/ledger">
        <FilterInput name="user" label="User ID or email" value={user} />
        <FilterSelect name="account" label="Account" value={account} options={accountTypeEnum.enumValues} />
        <FilterSelect name="type" label="Transaction type" value={type} options={ledgerTxTypeEnum.enumValues} />
        <FilterSelect name="source" label="Reward source" value={source} options={rewardSourceEnum.enumValues} />
        <FilterSelect name="status" label="Kind" value={str(sp.status)} options={[{ value: "reversal", label: "Reversals only" }]} />
        <FilterInput name="min" label="Min amount" value={min} className="w-24" />
        <FilterInput name="max" label="Max amount" value={max} className="w-24" />
        <FilterInput name="ref" label="Reference ID" value={ref} placeholder="Tx, source or idempotency key" />
        <FilterInput name="from" label="From" type="date" value={from} />
        <FilterInput name="to" label="To" type="date" value={to} />
      </FilterBar>
      <DataTable rows={rows} columns={columns} rowKey={(r) => String(r.id)} empty="No ledger entries match" />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/finance/ledger" />
    </AdminPage>
  );
}
