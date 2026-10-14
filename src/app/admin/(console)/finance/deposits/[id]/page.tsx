import { and, desc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, TextActionForm } from "@/components/admin/actions";
import { AdminCard, AdminPage, DataTable, KeyValue, UserLink } from "@/components/admin/ui";
import { StatusBadge , humanize } from "@/components/shared/status-badge";
import { db } from "@/db";
import { deposits, paymentAccounts, profiles, uploadedFiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime } from "@/lib/time";
import { approveDepositAction, rejectDepositAction, reverseDepositAction, saveInternalNoteAction } from "@/server/actions/admin/ops";

export const metadata: Metadata = { title: "Deposit" };

export default async function DepositDetailPage({ params }: PageProps<"/admin/finance/deposits/[id]">) {
  const fiat = await getFiatDisplay();
  const ctx = await requireAdmin("finance.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ d: deposits, user: profiles, account: paymentAccounts, file: { id: uploadedFiles.id, mimeType: uploadedFiles.mimeType, sizeBytes: uploadedFiles.sizeBytes, sha256: uploadedFiles.sha256 } })
    .from(deposits)
    .innerJoin(profiles, eq(profiles.id, deposits.userId))
    .leftJoin(paymentAccounts, eq(paymentAccounts.id, deposits.paymentAccountId))
    .leftJoin(uploadedFiles, eq(uploadedFiles.id, deposits.proofFileId))
    .where(eq(deposits.id, id))
    .limit(1);
  if (!row) notFound();
  const { d, user } = row;
  const [reviewer, sameRef, history] = await Promise.all([
    d.reviewerId ? db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, d.reviewerId)).limit(1) : Promise.resolve([]),
    db.select({ id: deposits.id, userId: deposits.userId, status: deposits.status }).from(deposits).where(and(eq(deposits.reference, d.reference), ne(deposits.id, d.id))).limit(5),
    db.select().from(deposits).where(and(eq(deposits.userId, d.userId), ne(deposits.id, d.id))).orderBy(desc(deposits.createdAt)).limit(8),
  ]);
  const canManage = ctx.can("deposits.manage");

  return (
    <AdminPage
      title={`Deposit ${formatCash(d.amount, { currency: fiat })}`}
      description={<span className="flex items-center gap-2">Submitted {formatDateTime(d.createdAt)} <StatusBadge status={d.status} /></span>}
      actions={
        canManage && (
          <>
            {d.status === "PENDING" && (
              <>
                <ActionButton
                  action={approveDepositAction}
                  args={[d.id]}
                  success="Deposit approved"
                  confirm={{ title: `Approve ${formatCash(d.amount, { currency: fiat })}?`, description: `Confirm the transfer with reference ${d.reference} has arrived in the company account. The amount is credited to ${user.name}'s Cash wallet.`, reasonLabel: "Review note (optional)", reasonRequired: false, confirmLabel: "Approve" }}
                >
                  Approve
                </ActionButton>
                <ActionButton action={rejectDepositAction} args={[d.id]} success="Deposit rejected" variant="outline" confirm={{ title: "Reject this deposit?", description: "The reason is shown to the user.", reasonLabel: "Reason shown to user", destructive: true, confirmLabel: "Reject" }}>
                  Reject
                </ActionButton>
              </>
            )}
            {d.status === "APPROVED" && (
              <ActionButton action={reverseDepositAction} args={[d.id]} success="Deposit reversed" variant="outline" confirm={{ title: "Reverse this deposit?", description: "Use for bounced or clawed-back transfers. A compensating ledger entry debits the user's Cash wallet. Fails if their Cash balance is insufficient.", reasonLabel: "Reason", destructive: true, confirmLabel: "Reverse" }}>
                Reverse
              </ActionButton>
            )}
          </>
        )
      }
    >
      {sameRef.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          The same reference was used on {sameRef.length} other deposit{sameRef.length > 1 ? "s" : ""}:{" "}
          {sameRef.map((x, i) => (
            <Link key={x.id} href={`/admin/finance/deposits/${x.id}`} className="font-medium underline">
              {i > 0 ? ", " : ""}
              {x.status.toLowerCase()}
            </Link>
          ))}
          . Check for duplicates before approving.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <AdminCard title="Transfer details">
            <KeyValue
              items={[
                ["Amount", <span key="a" className="text-lg">{formatCash(d.amount, { currency: fiat })}</span>],
                ["Method", humanize(d.method)],
                ["Payment reference", <code key="r">{d.reference}</code>],
                ["Payer name", d.payerName],
                ["Paid to", row.account ? `${row.account.bankName} ${row.account.accountNumber}` : "-"],
                ["User note", d.userNote ?? "-"],
                ["Reviewer", reviewer[0]?.name ?? "-"],
                ["Reviewed", d.reviewedAt ? formatDateTime(d.reviewedAt) : "-"],
                ["Review note", d.reviewNote ?? "-"],
                ["Ledger transaction", d.ledgerTransactionId ? <Link key="l" href={`/admin/finance/ledger/${d.ledgerTransactionId}`} className="text-primary hover:underline">View</Link> : "-"],
              ]}
            />
          </AdminCard>
          <AdminCard title="Proof of payment">
            {row.file?.id ? (
              <div className="space-y-2">
                {row.file.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${row.file.id}`} alt="Deposit proof" className="max-h-[520px] rounded-lg border object-contain" />
                ) : (
                  <iframe src={`/api/files/${row.file.id}`} title="Deposit proof" className="h-[520px] w-full rounded-lg border" />
                )}
                <p className="text-xs text-muted-foreground">
                  {row.file.mimeType} · {(row.file.sizeBytes / 1024).toFixed(0)} KB · sha256 {row.file.sha256.slice(0, 16)}… ·{" "}
                  <a href={`/api/files/${row.file.id}`} target="_blank" rel="noreferrer" className="text-primary underline">
                    Open in new tab
                  </a>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No proof uploaded. Verify the reference against the bank statement.</p>
            )}
          </AdminCard>
        </div>
        <div className="space-y-4">
          <AdminCard title="User">
            <UserLink id={user.id} name={user.name} email={user.email} />
            <div className="mt-3">
              <KeyValue items={[["Status", <StatusBadge key="s" status={user.status} />], ["Total deposits", formatCash(user.totalDeposits, { currency: fiat })], ["Verification", user.verificationStatus]]} />
            </div>
          </AdminCard>
          {canManage && (
            <AdminCard title="Internal notes">
              <TextActionForm action={saveInternalNoteAction} args={["deposit", d.id]} label="Staff only" initial={d.internalNote ?? ""} />
            </AdminCard>
          )}
          <AdminCard title="Other deposits by this user" bodyClassName="p-0">
            <DataTable
              rows={history}
              rowKey={(r) => r.id}
              empty="First deposit"
              columns={[
                { key: "at", header: "When", cell: (r) => <Link href={`/admin/finance/deposits/${r.id}`} className="text-xs text-primary hover:underline">{formatDateTime(r.createdAt)}</Link> },
                { key: "a", header: "Amount", align: "right", cell: (r) => formatCash(r.amount, { currency: fiat }) },
                { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              ]}
            />
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}
