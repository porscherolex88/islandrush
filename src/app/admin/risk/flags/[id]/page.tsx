import { asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, TextActionForm } from "@/components/admin/actions";
import { AdminCard, AdminPage, DataTable, JsonBlock, KeyValue, UserLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { profiles, riskFlags, riskNotes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime } from "@/lib/time";
import { setRewardHoldAction, setSuspensionAction, updateRiskFlagAction } from "@/server/actions/admin/ops";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Risk flag" };

type Party = { id: string; name: string; email: string; status: string; rewards_on_hold: boolean; created_at: string; total_deposits: string; signup_ip: string | null; signup_device_id: string | null; referred_by_id: string | null; pending: string; open_flags: number };

async function party(id: string) {
  return one<Party | undefined>(sql`
    select p.id, p.name, p.email, p.status::text, p.rewards_on_hold, p.created_at::text, p.total_deposits::text, p.signup_ip, p.signup_device_id, p.referred_by_id,
      (select coalesce(sum(amount), 0)::text from cash_rewards where user_id = p.id and status in ('PENDING', 'HELD')) as pending,
      (select count(*)::int from risk_flags where user_id = p.id and status in ('OPEN', 'IN_REVIEW')) as open_flags
    from profiles p where p.id = ${id}`);
}

export default async function RiskFlagPage({ params }: PageProps<"/admin/risk/flags/[id]">) {
  const fiat = await getFiatDisplay();
  const admin = await requireAdmin("risk.view");
  const canManage = admin.can("risk.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [flag] = await db.select().from(riskFlags).where(eq(riskFlags.id, id)).limit(1);
  if (!flag) notFound();
  const [user, related, notes, assignee, overlap] = await Promise.all([
    party(flag.userId),
    flag.relatedUserId ? party(flag.relatedUserId) : Promise.resolve(undefined),
    db.select({ n: riskNotes, author: profiles.name }).from(riskNotes).innerJoin(profiles, eq(profiles.id, riskNotes.authorId)).where(eq(riskNotes.flagId, id)).orderBy(asc(riskNotes.createdAt)),
    flag.assignedToId ? db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, flag.assignedToId)).then((r) => r[0]?.name ?? null) : Promise.resolve(null),
    flag.relatedUserId
      ? rows<{ kind: string; value: string }>(sql`
          select 'IP' as kind, a.ip as value from login_events a join login_events b on a.ip = b.ip where a.user_id = ${flag.userId} and b.user_id = ${flag.relatedUserId} and a.ip is not null
          union select 'Device', a.device_id from login_events a join login_events b on a.device_id = b.device_id where a.user_id = ${flag.userId} and b.user_id = ${flag.relatedUserId} and a.device_id is not null
          union select 'Withdrawal account', a.account_number from withdrawal_accounts a join withdrawal_accounts b on a.account_number = b.account_number where a.user_id = ${flag.userId} and b.user_id = ${flag.relatedUserId}
          limit 20`)
      : Promise.resolve([]),
  ]);
  if (!user) notFound();
  const active = flag.status === "OPEN" || flag.status === "IN_REVIEW";

  return (
    <AdminPage
      title={flag.summary}
      description={`${flag.type.replace(/_/g, " ").toLowerCase()} · raised ${formatDateTime(flag.createdAt)}`}
      actions={
        <>
          <StatusBadge status={flag.severity} />
          <StatusBadge status={flag.status} />
        </>
      }
    >
      {canManage && (
        <AdminCard title="Actions">
          <div className="flex flex-wrap gap-2">
            {flag.assignedToId !== admin.user.id ? (
              <ActionButton action={updateRiskFlagAction} args={[id, { assignToMe: true }, null]} variant="outline" success="Assigned to you">
                Assign to me
              </ActionButton>
            ) : (
              <ActionButton action={updateRiskFlagAction} args={[id, { unassign: true }, null]} variant="outline" success="Unassigned">
                Unassign
              </ActionButton>
            )}
            {flag.status === "OPEN" && (
              <ActionButton action={updateRiskFlagAction} args={[id, { status: "IN_REVIEW", assignToMe: !flag.assignedToId }, null]} variant="outline" success="Marked in review">
                Start review
              </ActionButton>
            )}
            {active && (
              <>
                <ActionButton action={updateRiskFlagAction} args={[id, { status: "CLEARED" }]} variant="outline" success="Flag cleared" confirm={{ title: "Clear this flag?", description: "Use when the activity is legitimate. Your note is saved on the flag.", reasonLabel: "Resolution note", confirmLabel: "Clear flag" }}>
                  Clear
                </ActionButton>
                <ActionButton action={updateRiskFlagAction} args={[id, { status: "CONFIRMED" }]} success="Flag confirmed" confirm={{ title: "Confirm abuse?", description: "Marks the flag as confirmed. Suspend the account or hold rewards separately if needed.", reasonLabel: "Finding", destructive: true, confirmLabel: "Confirm" }}>
                  Confirm abuse
                </ActionButton>
              </>
            )}
            {!active && (
              <ActionButton action={updateRiskFlagAction} args={[id, { status: "OPEN" }]} variant="outline" success="Flag reopened" confirm={{ title: "Reopen this flag?", reasonLabel: "Reason" }}>
                Reopen
              </ActionButton>
            )}
          </div>
        </AdminCard>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {[user, related].filter((p): p is Party => Boolean(p)).map((p, i) => (
          <AdminCard key={p.id} title={i === 0 ? "Flagged user" : "Related user"} actions={<Button asChild size="sm" variant="outline"><Link href={`/admin/users/${p.id}?tab=risk`}>Open profile</Link></Button>}>
            <UserLink id={p.id} name={p.name} email={p.email} />
            <div className="mt-3">
              <KeyValue
                items={[
                  ["Status", <StatusBadge key="s" status={p.status} />],
                  ["Joined", formatDateTime(p.created_at)],
                  ["Lifetime deposits", formatCash(p.total_deposits, { currency: fiat })],
                  ["Pending/held rewards", formatCash(p.pending, { currency: fiat })],
                  ["Rewards on hold", p.rewards_on_hold ? "Yes" : "No"],
                  ["Active flags", p.open_flags],
                  ["Signup IP", p.signup_ip ?? "-"],
                  ["Referred by", p.referred_by_id ? <Link key="r" href={`/admin/users/${p.referred_by_id}`} className="text-primary hover:underline">View referrer</Link> : "-"],
                ]}
              />
            </div>
            {canManage && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton action={setRewardHoldAction} args={[p.id, !p.rewards_on_hold]} variant="outline" success={p.rewards_on_hold ? "Rewards released" : "Rewards held"} confirm={{ title: p.rewards_on_hold ? "Release reward hold?" : "Hold all rewards?", description: p.rewards_on_hold ? "Held rewards return to pending and settle on schedule." : "Pending and future cash rewards stay held until released.", reasonLabel: "Reason" }}>
                  {p.rewards_on_hold ? "Release rewards" : "Hold rewards"}
                </ActionButton>
                {admin.can("users.manage") && (
                  <ActionButton action={setSuspensionAction} args={[p.id, p.status !== "SUSPENDED"]} variant={p.status === "SUSPENDED" ? "outline" : "destructive"} success={p.status === "SUSPENDED" ? "Account reactivated" : "Account suspended"} confirm={{ title: p.status === "SUSPENDED" ? "Reactivate account?" : "Suspend account?", reasonLabel: "Reason", destructive: p.status !== "SUSPENDED" }}>
                    {p.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                  </ActionButton>
                )}
              </div>
            )}
          </AdminCard>
        ))}
      </div>
      {overlap.length > 0 && (
        <AdminCard title="Shared signals" bodyClassName="p-0">
          <DataTable rows={overlap} rowKey={(o) => `${o.kind}-${o.value}`} columns={[{ key: "k", header: "Signal", cell: (o) => o.kind }, { key: "v", header: "Value", cell: (o) => <code className="text-xs">{o.value}</code> }]} />
        </AdminCard>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Details">
          <KeyValue items={[["Assignee", assignee ?? "Unassigned"], ["Resolved", flag.resolvedAt ? formatDateTime(flag.resolvedAt) : "-"]]} />
          <div className="mt-3">
            <JsonBlock value={flag.details} />
          </div>
        </AdminCard>
        <AdminCard title="Notes">
          <div className="space-y-3">
            {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            {notes.map(({ n, author }) => (
              <div key={n.id} className="rounded-lg border p-3 text-sm">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {author} · {formatDateTime(n.createdAt)}
                </p>
              </div>
            ))}
            {canManage && <TextActionForm action={updateRiskFlagAction} args={[id, {}]} label="Add note" submitLabel="Add note" success="Note added" clearOnSuccess />}
          </div>
        </AdminCard>
      </div>
    </AdminPage>
  );
}
