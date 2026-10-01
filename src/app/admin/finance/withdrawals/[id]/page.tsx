import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, TextActionForm } from "@/components/admin/actions";
import { CompleteWithdrawalButton } from "@/components/admin/finance-forms";
import { AdminCard, AdminPage, DataTable, KeyValue, UserLink } from "@/components/admin/ui";
import { StatusBadge , humanize } from "@/components/shared/status-badge";
import { db } from "@/db";
import { cashRewards, depositLevels, profiles, riskFlags, withdrawalAccounts, withdrawals } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime } from "@/lib/time";
import { saveInternalNoteAction, withdrawalAction } from "@/server/actions/admin/ops";
import { getWithdrawalEligibility } from "@/server/services/withdrawals";

export const metadata: Metadata = { title: "Withdrawal" };

export default async function WithdrawalDetailPage({ params }: PageProps<"/admin/finance/withdrawals/[id]">) {
  const fiat = await getFiatDisplay();
  const ctx = await requireAdmin("finance.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db.select({ w: withdrawals, user: profiles, level: depositLevels.name }).from(withdrawals).innerJoin(profiles, eq(profiles.id, withdrawals.userId)).leftJoin(depositLevels, eq(depositLevels.id, profiles.depositLevelId)).where(eq(withdrawals.id, id)).limit(1);
  if (!row) notFound();
  const { w, user } = row;
  const [elig, flags, sources, reviewer, sharedAccount, previous] = await Promise.all([
    getWithdrawalEligibility(user.id),
    db.select().from(riskFlags).where(and(eq(riskFlags.userId, user.id), inArray(riskFlags.status, ["OPEN", "IN_REVIEW"]))),
    db.select({ source: cashRewards.source, status: cashRewards.status, total: sql<string>`sum(${cashRewards.amount})`, n: sql<number>`count(*)::int` }).from(cashRewards).where(eq(cashRewards.userId, user.id)).groupBy(cashRewards.source, cashRewards.status),
    w.reviewerId ? db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, w.reviewerId)).limit(1) : Promise.resolve([]),
    db.select({ userId: withdrawalAccounts.userId, name: profiles.name }).from(withdrawalAccounts).innerJoin(profiles, eq(profiles.id, withdrawalAccounts.userId)).where(and(eq(withdrawalAccounts.accountNumber, w.accountSnapshot.accountNumber), ne(withdrawalAccounts.userId, user.id))).limit(5),
    db.select().from(withdrawals).where(and(eq(withdrawals.userId, user.id), ne(withdrawals.id, w.id))).orderBy(desc(withdrawals.createdAt)).limit(6),
  ]);
  const canManage = ctx.can("withdrawals.manage");
  const amount = formatCash(w.amount, { currency: fiat });
  const reject = (
    <ActionButton action={withdrawalAction} args={[w.id, "reject"]} variant="outline" success="Withdrawal rejected, funds returned" confirm={{ title: "Reject this withdrawal?", description: "Funds go back to the user's Withdrawable balance. The reason is included in their notification.", reasonLabel: "Reason shown to user", destructive: true, confirmLabel: "Reject" }}>
      Reject
    </ActionButton>
  );

  return (
    <AdminPage
      title={`Withdrawal ${amount}`}
      description={<span className="flex items-center gap-2">Requested {formatDateTime(w.createdAt)} <StatusBadge status={w.status} /></span>}
      actions={
        canManage && (
          <>
            {w.status === "PENDING" && (
              <ActionButton action={withdrawalAction} args={[w.id, "review", null]} variant="outline" success="Moved to review">
                Move to review
              </ActionButton>
            )}
            {(w.status === "PENDING" || w.status === "REVIEW") && (
              <ActionButton action={withdrawalAction} args={[w.id, "approve"]} success="Withdrawal approved" confirm={{ title: `Approve ${amount}?`, description: flags.length ? "This user has open risk flags. Make sure they are reviewed first." : "The user is notified that their withdrawal is approved.", reasonLabel: "Review note (optional)", reasonRequired: false, confirmLabel: "Approve" }}>
                Approve
              </ActionButton>
            )}
            {w.status === "APPROVED" && (
              <ActionButton action={withdrawalAction} args={[w.id, "process", null]} success="Marked as processing">
                Start processing
              </ActionButton>
            )}
            {w.status === "PROCESSING" && <CompleteWithdrawalButton id={w.id} amount={amount} />}
            {["PENDING", "REVIEW", "APPROVED", "PROCESSING"].includes(w.status) && reject}
            {w.status === "COMPLETED" && (
              <ActionButton action={withdrawalAction} args={[w.id, "reverse"]} variant="outline" success="Payout reversed" confirm={{ title: "Reverse this completed payout?", description: "Use only when the bank returned the transfer. Funds are credited back to Withdrawable.", reasonLabel: "Reason", destructive: true, confirmLabel: "Reverse" }}>
                Reverse payout
              </ActionButton>
            )}
          </>
        )
      }
    >
      {(flags.length > 0 || user.rewardsOnHold || sharedAccount.length > 0) && (
        <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          {flags.length > 0 && (
            <p>
              {flags.length} open risk flag{flags.length > 1 ? "s" : ""}:{" "}
              {flags.map((f, i) => (
                <Link key={f.id} href={`/admin/risk/flags/${f.id}`} className="underline">
                  {i > 0 ? ", " : ""}
                  {humanize(f.type).toLowerCase()}
                </Link>
              ))}
            </p>
          )}
          {user.rewardsOnHold && <p>This user&apos;s rewards are on hold.</p>}
          {sharedAccount.length > 0 && (
            <p>
              Bank account also saved by:{" "}
              {sharedAccount.map((s, i) => (
                <Link key={s.userId} href={`/admin/users/${s.userId}`} className="underline">
                  {i > 0 ? ", " : ""}
                  {s.name}
                </Link>
              ))}
            </p>
          )}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <AdminCard title="Request">
            <KeyValue
              items={[
                ["Requested amount", <span key="a" className="text-lg">{amount}</span>],
                ["Bank", w.accountSnapshot.bankName],
                ["Account name", w.accountSnapshot.accountName],
                ["Account number", <code key="n">{w.accountSnapshot.accountNumber}</code>],
                ["Name matches profile", w.accountSnapshot.accountName.trim().toLowerCase() === user.name.trim().toLowerCase() ? "Yes" : <span key="m" className="text-amber-700">No, check carefully</span>],
                ["Reviewer", reviewer[0]?.name ?? "-"],
                ["Review note", w.reviewNote ?? "-"],
                ["Payout reference", w.payoutReference ?? "-"],
                ["Completed", w.completedAt ? formatDateTime(w.completedAt) : "-"],
                ["Ledger", w.requestTransactionId ? <Link key="l" href={`/admin/finance/ledger/${w.requestTransactionId}`} className="text-primary hover:underline">Request transaction</Link> : "-"],
              ]}
            />
          </AdminCard>
          <AdminCard title="Eligibility summary" description="Recomputed now from the user's current state">
            <KeyValue
              cols={3}
              items={[
                ["Deposit level", row.level ?? "None"],
                ["Current withdrawable", formatCash(elig.available, { currency: fiat })],
                ["Verification", user.verificationStatus + (user.verificationRequired ? " (required)" : "")],
                ["Minimum", formatCash(elig.min, { currency: fiat })],
                ["Remaining limit", formatCash(elig.max, { currency: fiat })],
                ["Would need review", elig.requiresReview ? "Yes" : "No"],
              ]}
            />
            {elig.reasons.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground">
                {elig.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </AdminCard>
          <AdminCard title="Reward and referral source breakdown" description="Where this user's cash rewards came from" bodyClassName="p-0">
            <DataTable
              rows={sources}
              rowKey={(r) => `${r.source}-${r.status}`}
              empty="No cash rewards. Withdrawable funds come from adjustments only."
              columns={[
                { key: "s", header: "Source", cell: (r) => humanize(r.source) },
                { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                { key: "n", header: "Count", align: "right", cell: (r) => r.n },
                { key: "t", header: "Total", align: "right", cell: (r) => formatCash(r.total, { currency: fiat }) },
              ]}
            />
            {Object.keys(w.sourceBreakdown).length > 0 && (
              <div className="border-t p-4 text-xs text-muted-foreground">
                At request time:{" "}
                {Object.entries(w.sourceBreakdown)
                  .map(([k, v]) => `${humanize(k).toLowerCase()} ${formatCash(v, { currency: fiat })}`)
                  .join(" · ")}
              </div>
            )}
          </AdminCard>
        </div>
        <div className="space-y-4">
          <AdminCard title="User">
            <UserLink id={user.id} name={user.name} email={user.email} />
            <div className="mt-3">
              <KeyValue items={[["Status", <StatusBadge key="s" status={user.status} />], ["Total deposits", formatCash(user.totalDeposits, { currency: fiat })], ["Joined", formatDateTime(user.createdAt)]]} />
            </div>
          </AdminCard>
          {canManage && (
            <AdminCard title="Internal notes">
              <TextActionForm action={saveInternalNoteAction} args={["withdrawal", w.id]} label="Staff only" initial={w.internalNote ?? ""} />
            </AdminCard>
          )}
          <AdminCard title="Previous withdrawals" bodyClassName="p-0">
            <DataTable
              rows={previous}
              rowKey={(r) => r.id}
              empty="First withdrawal"
              columns={[
                { key: "at", header: "When", cell: (r) => <Link href={`/admin/finance/withdrawals/${r.id}`} className="text-xs text-primary hover:underline">{formatDateTime(r.createdAt)}</Link> },
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
