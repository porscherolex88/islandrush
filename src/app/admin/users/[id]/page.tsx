import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, TextActionForm } from "@/components/admin/actions";
import { AdminCard, AdminPage, KeyValue, StatGrid, StatsCard, Tabs, str } from "@/components/admin/ui";
import { ManualFlagForm, SendNotificationForm, VerificationControls } from "@/components/admin/user-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { depositLevels, profiles, userStreaks } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDateTime, relativeTime } from "@/lib/time";
import { addUserNoteAction, setRewardHoldAction, setSuspensionAction } from "@/server/actions/admin/ops";
import { getBalances } from "@/server/services/ledger";
import * as T from "./tabs";

export const metadata: Metadata = { title: "User" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "wallet", label: "Wallet", perm: "finance.view" },
  { key: "ledger", label: "Ledger", perm: "finance.view" },
  { key: "deposits", label: "Deposits", perm: "finance.view" },
  { key: "withdrawals", label: "Withdrawals", perm: "finance.view" },
  { key: "games", label: "Game history" },
  { key: "boxes", label: "Mystery Boxes" },
  { key: "map", label: "Map activity" },
  { key: "vaults", label: "Vaults" },
  { key: "collections", label: "Collections" },
  { key: "inventory", label: "Inventory" },
  { key: "xp", label: "XP" },
  { key: "referrals", label: "Referrals", perm: "referrals.view" },
  { key: "notifications", label: "Notifications" },
  { key: "support", label: "Support", perm: "support.view" },
  { key: "security", label: "Security", perm: "risk.view" },
  { key: "risk", label: "Risk", perm: "risk.view" },
  { key: "audit", label: "Audit history", perm: "audit.view" },
] as const;

export default async function UserDetailPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const fiat = await getFiatDisplay();
  const ctx = await requireAdmin("users.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [row] = await db
    .select({
      p: profiles,
      level: depositLevels.name,
      streak: userStreaks.current,
      longest: userStreaks.longest,
      referrals: sql<number>`(select count(*)::int from profiles c where c.referred_by_id = ${profiles.id})`,
      referrer: sql<string | null>`(select name from profiles r where r.id = ${profiles.referredById})`,
      openFlags: sql<number>`(select count(*)::int from risk_flags rf where rf.user_id = ${profiles.id} and rf.status in ('OPEN','IN_REVIEW'))`,
    })
    .from(profiles)
    .leftJoin(depositLevels, eq(depositLevels.id, profiles.depositLevelId))
    .leftJoin(userStreaks, eq(userStreaks.userId, profiles.id))
    .where(eq(profiles.id, id))
    .limit(1);
  if (!row) notFound();
  const u = row.p;
  const tabs = TABS.filter((t) => !("perm" in t) || ctx.can(t.perm));
  const tab = tabs.find((t) => t.key === str(sp.tab))?.key ?? "overview";
  const balances = ctx.can("finance.view") ? await getBalances(u.id) : null;
  const canManage = ctx.can("users.manage");
  const base = `/admin/users/${u.id}`;

  return (
    <AdminPage
      title={u.name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          {u.email} · <code className="text-xs">{u.id}</code>
          <StatusBadge status={u.status} />
          {u.role !== "USER" && <StatusBadge status={u.role} tone="brand" />}
          {u.rewardsOnHold && <StatusBadge status="HELD" label="Rewards on hold" />}
          {row.openFlags > 0 && <StatusBadge status="FLAG" tone="danger" label={`${row.openFlags} open flag${row.openFlags > 1 ? "s" : ""}`} />}
        </span>
      }
      actions={
        <>
          {ctx.can("ledger.adjust") && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/finance/adjustments?userId=${u.id}`}>Adjust balance</Link>
            </Button>
          )}
          {canManage &&
            (u.status === "ACTIVE" ? (
              <ActionButton action={setSuspensionAction} args={[u.id, true]} success="Account suspended" confirm={{ title: `Suspend ${u.name}?`, description: "They will be unable to play, deposit or withdraw until unsuspended. They'll be told to contact support.", reasonLabel: "Internal reason", destructive: true, confirmLabel: "Suspend" }}>
                Suspend
              </ActionButton>
            ) : (
              <ActionButton action={setSuspensionAction} args={[u.id, false]} success="Account restored" confirm={{ title: `Unsuspend ${u.name}?`, reasonLabel: "Reason" }}>
                Unsuspend
              </ActionButton>
            ))}
        </>
      }
    >
      {u.status === "SUSPENDED" && u.suspendedReason && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Suspended: {u.suspendedReason}</p>}
      <Tabs tabs={tabs.map((t) => ({ key: t.key, label: t.label }))} active={tab} basePath={base} sp={sp} />

      {tab === "overview" && (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            {balances && (
              <StatGrid cols={4}>
                <StatsCard label="Cash" value={formatCash(balances.CASH, { currency: fiat })} />
                <StatsCard label="Credits" value={formatCredits(balances.CREDITS)} />
                <StatsCard label="Pending rewards" value={formatCash(balances.PENDING_REWARDS, { currency: fiat })} />
                <StatsCard label="Withdrawable" value={formatCash(balances.WITHDRAWABLE, { currency: fiat })} tone="brand" />
              </StatGrid>
            )}
            <AdminCard title="Profile">
              <KeyValue
                cols={3}
                items={[
                  ["Name", u.name],
                  ["Email", u.email],
                  ["Phone", u.phone ?? "-"],
                  ["Referral code", <code key="c">{u.referralCode}</code>],
                  ["Referred by", u.referredById ? <Link key="r" href={`/admin/users/${u.referredById}`} className="text-primary hover:underline">{row.referrer}</Link> : "-"],
                  ["Direct referrals", row.referrals],
                  ["Joined", formatDateTime(u.createdAt)],
                  ["Last seen", u.lastSeenAt ? relativeTime(u.lastSeenAt) : "Never"],
                  ["Timezone for days", "Asia/Kuala_Lumpur"],
                ]}
              />
            </AdminCard>
            <AdminCard title="Progression">
              <KeyValue
                cols={3}
                items={[
                  ["XP level", `Level ${u.xpLevel}`],
                  ["Total XP", u.xpTotal.toLocaleString()],
                  ["Deposit level", row.level ?? "None"],
                  ["Total deposits", formatCash(u.totalDeposits, { currency: fiat })],
                  ["Current streak", `${row.streak ?? 0} days`],
                  ["Longest streak", `${row.longest ?? 0} days`],
                ]}
              />
            </AdminCard>
            <AdminCard title="Verification and responsible play">
              <KeyValue
                cols={3}
                items={[
                  ["Verification", <StatusBadge key="v" status={u.verificationStatus} />],
                  ["Required before withdrawal", u.verificationRequired ? "Yes" : "No"],
                  ["Verification note", u.verificationNote ?? "-"],
                  ["Daily Credit limit", u.playLimits.dailyCreditLimit ? formatCredits(u.playLimits.dailyCreditLimit) : "None"],
                  ["Play break until", u.playLimits.selfExcludedUntil ? formatDateTime(u.playLimits.selfExcludedUntil) : "None"],
                ]}
              />
            </AdminCard>
          </div>
          <div className="space-y-4">
            {canManage && (
              <AdminCard title="Verification">
                <VerificationControls userId={u.id} status={u.verificationStatus} required={u.verificationRequired} />
              </AdminCard>
            )}
            {canManage && (
              <AdminCard title="Internal note">
                <TextActionForm action={addUserNoteAction} args={[u.id]} label="Visible to staff only" submitLabel="Add note" success="Note added" clearOnSuccess />
              </AdminCard>
            )}
            {ctx.can("risk.manage") && (
              <AdminCard title="Risk controls">
                <div className="space-y-4">
                  {u.rewardsOnHold ? (
                    <ActionButton action={setRewardHoldAction} args={[u.id, false]} variant="outline" success="Rewards released" confirm={{ title: "Release reward hold?", description: "Held rewards return to pending and settle normally.", reasonLabel: "Reason" }}>
                      Release reward hold
                    </ActionButton>
                  ) : (
                    <ActionButton action={setRewardHoldAction} args={[u.id, true]} variant="outline" success="Rewards placed on hold" confirm={{ title: "Hold all rewards?", description: "Pending cash rewards stop settling until the hold is released. The user is not told why.", reasonLabel: "Internal reason" }}>
                      Place reward hold
                    </ActionButton>
                  )}
                  <ManualFlagForm userId={u.id} />
                </div>
              </AdminCard>
            )}
            {ctx.can("notifications.manage") && (
              <AdminCard title="Message user">
                <SendNotificationForm userId={u.id} />
              </AdminCard>
            )}
          </div>
        </div>
      )}
      {tab === "wallet" && <T.WalletTab userId={u.id} canManageRisk={ctx.can("risk.manage")} />}
      {tab === "ledger" && <T.LedgerTab userId={u.id} />}
      {tab === "deposits" && <T.DepositsTab userId={u.id} />}
      {tab === "withdrawals" && <T.WithdrawalsTab userId={u.id} />}
      {tab === "games" && <T.GamesTab userId={u.id} />}
      {tab === "boxes" && <T.BoxesTab userId={u.id} />}
      {tab === "map" && <T.MapTab userId={u.id} />}
      {tab === "vaults" && <T.VaultsTab userId={u.id} />}
      {tab === "collections" && <T.CollectionsTab userId={u.id} />}
      {tab === "inventory" && <T.InventoryTab userId={u.id} />}
      {tab === "xp" && <T.XpTab userId={u.id} />}
      {tab === "referrals" && <T.ReferralsTab userId={u.id} referredById={u.referredById} />}
      {tab === "notifications" && <T.NotificationsTab userId={u.id} />}
      {tab === "support" && <T.SupportTab userId={u.id} />}
      {tab === "security" && <T.SecurityTab userId={u.id} signupIp={u.signupIp} signupDeviceId={u.signupDeviceId} />}
      {tab === "risk" && <T.RiskTab userId={u.id} />}
      {tab === "audit" && <T.AuditTab userId={u.id} />}
    </AdminPage>
  );
}
