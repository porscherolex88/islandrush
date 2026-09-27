import { and, desc, eq, or, sql } from "drizzle-orm";
import Link from "next/link";
import { ActionButton } from "@/components/admin/actions";
import { AdminCard, DataTable, DiffView, JsonBlock, KeyValue, StatGrid, StatsCard, UserLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import * as s from "@/db/schema";
import { formatCredits, formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { cashRewardAction } from "@/server/actions/admin/ops";
import { getBalances } from "@/server/services/ledger";

const dt = (d: Date | null) => (d ? <span className="text-xs whitespace-nowrap">{formatDateTime(d)}</span> : "-");
const rewardLabel = (r: unknown) => {
  const x = (r ?? {}) as { label?: string; icon?: string };
  return `${x.icon ?? ""} ${x.label ?? "Reward"}`.trim();
};

export async function WalletTab({ userId, canManageRisk }: { userId: string; canManageRisk: boolean }) {
  const [b, rewards, conv] = await Promise.all([
    getBalances(userId),
    db.select().from(s.cashRewards).where(eq(s.cashRewards.userId, userId)).orderBy(desc(s.cashRewards.createdAt)).limit(50),
    db.select().from(s.conversions).where(eq(s.conversions.userId, userId)).orderBy(desc(s.conversions.createdAt)).limit(20),
  ]);
  return (
    <div className="space-y-4">
      <StatGrid cols={5}>
        <StatsCard label="Cash" value={formatMYR(b.CASH)} />
        <StatsCard label="Credits" value={formatCredits(b.CREDITS)} />
        <StatsCard label="Pending rewards" value={formatMYR(b.PENDING_REWARDS)} />
        <StatsCard label="Withdrawable" value={formatMYR(b.WITHDRAWABLE)} tone="brand" />
        <StatsCard label="Withdrawal pending" value={formatMYR(b.WITHDRAWAL_PENDING)} />
      </StatGrid>
      <AdminCard title="Cash rewards" bodyClassName="p-0">
        <DataTable
          rows={rewards}
          rowKey={(r) => r.id}
          empty="No cash rewards"
          columns={[
            { key: "amt", header: "Amount", align: "right", cell: (r) => formatMYR(r.amount) },
            { key: "src", header: "Source", cell: (r) => r.source.replace("_", " ") },
            { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "settle", header: "Settles", cell: (r) => dt(r.settleAfter) },
            { key: "note", header: "Note", cell: (r) => <span className="text-xs text-muted-foreground">{r.heldReason ?? ""}</span> },
            {
              key: "act",
              header: "",
              cell: (r) =>
                canManageRisk && r.status !== "REVERSED" ? (
                  <div className="flex justify-end gap-1">
                    {r.status === "PENDING" && (
                      <ActionButton action={cashRewardAction} args={[r.id, "hold"]} variant="outline" success="Reward held" confirm={{ title: "Hold this reward?", reasonLabel: "Reason" }}>
                        Hold
                      </ActionButton>
                    )}
                    {r.status === "HELD" && (
                      <ActionButton action={cashRewardAction} args={[r.id, "release"]} variant="outline" success="Reward released" confirm={{ title: "Release this reward?", reasonLabel: "Reason" }}>
                        Release
                      </ActionButton>
                    )}
                    <ActionButton action={cashRewardAction} args={[r.id, "reverse"]} variant="ghost" success="Reward reversed" confirm={{ title: "Reverse this reward?", description: "A compensating ledger entry removes it from the user's balance.", reasonLabel: "Reason", destructive: true }}>
                      Reverse
                    </ActionButton>
                  </div>
                ) : null,
            },
          ]}
        />
      </AdminCard>
      <AdminCard title="Credit conversions" bodyClassName="p-0">
        <DataTable
          rows={conv}
          rowKey={(r) => r.id}
          empty="No conversions"
          columns={[
            { key: "cash", header: "Cash", align: "right", cell: (r) => formatMYR(r.cashAmount) },
            { key: "cr", header: "Credits", align: "right", cell: (r) => formatCredits(r.credits) },
            { key: "rate", header: "Rate", cell: (r) => `${formatMYR(r.rateCash)} = ${formatCredits(r.rateCredits)}` },
            { key: "at", header: "When", cell: (r) => dt(r.createdAt) },
          ]}
        />
      </AdminCard>
    </div>
  );
}

export async function LedgerTab({ userId }: { userId: string }) {
  const entries = await db
    .select({ id: s.ledgerEntries.id, account: s.ledgerEntries.accountType, amount: s.ledgerEntries.amount, balanceAfter: s.ledgerEntries.balanceAfter, createdAt: s.ledgerEntries.createdAt, txId: s.ledgerTransactions.id, type: s.ledgerTransactions.type, description: s.ledgerTransactions.description })
    .from(s.ledgerEntries)
    .innerJoin(s.ledgerTransactions, eq(s.ledgerTransactions.id, s.ledgerEntries.transactionId))
    .where(eq(s.ledgerEntries.userId, userId))
    .orderBy(desc(s.ledgerEntries.id))
    .limit(100);
  return (
    <DataTable
      rows={entries}
      rowKey={(r) => String(r.id)}
      empty="No ledger entries"
      columns={[
        { key: "at", header: "When", cell: (r) => dt(r.createdAt) },
        { key: "type", header: "Type", cell: (r) => <Link href={`/admin/finance/ledger/${r.txId}`} className="text-primary hover:underline">{r.type.replace(/_/g, " ")}</Link> },
        { key: "desc", header: "Description", cell: (r) => <span className="line-clamp-1 text-xs">{r.description}</span> },
        { key: "acct", header: "Account", cell: (r) => <code className="text-xs">{r.account}</code> },
        { key: "amt", header: "Amount", align: "right", cell: (r) => (r.account === "CREDITS" ? formatCredits(r.amount, { sign: true }) : formatMYR(r.amount, { sign: true })) },
        { key: "bal", header: "Balance after", align: "right", cell: (r) => (r.balanceAfter === null ? "-" : r.account === "CREDITS" ? formatCredits(r.balanceAfter) : formatMYR(r.balanceAfter)) },
      ]}
    />
  );
}

export async function DepositsTab({ userId }: { userId: string }) {
  const rows = await db.select().from(s.deposits).where(eq(s.deposits.userId, userId)).orderBy(desc(s.deposits.createdAt)).limit(100);
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      empty="No deposits"
      columns={[
        { key: "at", header: "Submitted", cell: (r) => <Link href={`/admin/finance/deposits/${r.id}`} className="text-primary hover:underline">{formatDateTime(r.createdAt)}</Link> },
        { key: "amt", header: "Amount", align: "right", cell: (r) => formatMYR(r.amount) },
        { key: "m", header: "Method", cell: (r) => r.method.replace("_", " ") },
        { key: "ref", header: "Reference", cell: (r) => <code className="text-xs">{r.reference}</code> },
        { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}

export async function WithdrawalsTab({ userId }: { userId: string }) {
  const [rows, accounts] = await Promise.all([
    db.select().from(s.withdrawals).where(eq(s.withdrawals.userId, userId)).orderBy(desc(s.withdrawals.createdAt)).limit(100),
    db.select().from(s.withdrawalAccounts).where(eq(s.withdrawalAccounts.userId, userId)),
  ]);
  return (
    <div className="space-y-4">
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty="No withdrawals"
        columns={[
          { key: "at", header: "Requested", cell: (r) => <Link href={`/admin/finance/withdrawals/${r.id}`} className="text-primary hover:underline">{formatDateTime(r.createdAt)}</Link> },
          { key: "amt", header: "Amount", align: "right", cell: (r) => formatMYR(r.amount) },
          { key: "bank", header: "Bank", cell: (r) => `${r.accountSnapshot.bankName} ${r.accountSnapshot.accountNumber}` },
          { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <AdminCard title="Saved withdrawal accounts" bodyClassName="p-0">
        <DataTable
          rows={accounts}
          rowKey={(r) => r.id}
          empty="No accounts"
          columns={[
            { key: "b", header: "Bank", cell: (r) => r.bankName },
            { key: "n", header: "Name", cell: (r) => r.accountName },
            { key: "no", header: "Number", cell: (r) => <code className="text-xs">{r.accountNumber}</code> },
            { key: "st", header: "State", cell: (r) => (r.archived ? <StatusBadge status="ARCHIVED" /> : r.isDefault ? <StatusBadge status="ACTIVE" label="Default" /> : "") },
          ]}
        />
      </AdminCard>
    </div>
  );
}

export async function BoxesTab({ userId }: { userId: string }) {
  const rows = await db
    .select({ id: s.mysteryBoxPlays.id, createdAt: s.mysteryBoxPlays.createdAt, box: s.mysteryBoxes.name, idx: s.mysteryBoxPlays.selectedIndex, spent: s.mysteryBoxPlays.creditsSpent, reward: s.mysteryBoxPlays.reward, xp: s.mysteryBoxPlays.xpAwarded })
    .from(s.mysteryBoxPlays)
    .innerJoin(s.mysteryBoxes, eq(s.mysteryBoxes.id, s.mysteryBoxPlays.boxId))
    .where(eq(s.mysteryBoxPlays.userId, userId))
    .orderBy(desc(s.mysteryBoxPlays.createdAt))
    .limit(100);
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      empty="No boxes opened"
      columns={[
        { key: "at", header: "When", cell: (r) => dt(r.createdAt) },
        { key: "box", header: "Box", cell: (r) => r.box },
        { key: "idx", header: "Picked", cell: (r) => `#${r.idx + 1}` },
        { key: "sp", header: "Credits", align: "right", cell: (r) => formatCredits(r.spent) },
        { key: "rw", header: "Reward", cell: (r) => rewardLabel(r.reward) },
        { key: "xp", header: "XP", align: "right", cell: (r) => r.xp },
      ]}
    />
  );
}

export async function MapTab({ userId }: { userId: string }) {
  const [tiles, areas] = await Promise.all([
    db
      .select({ id: s.tileDiscoveries.id, createdAt: s.tileDiscoveries.createdAt, area: s.mapAreas.name, tile: s.mapTiles.name, spent: s.tileDiscoveries.creditsSpent, free: s.tileDiscoveries.usedFreeDiscovery, reward: s.tileDiscoveries.reward })
      .from(s.tileDiscoveries)
      .innerJoin(s.mapTiles, eq(s.mapTiles.id, s.tileDiscoveries.tileId))
      .innerJoin(s.mapAreas, eq(s.mapAreas.id, s.tileDiscoveries.areaId))
      .where(eq(s.tileDiscoveries.userId, userId))
      .orderBy(desc(s.tileDiscoveries.createdAt))
      .limit(100),
    db.select({ id: s.areaUnlocks.id, area: s.mapAreas.name, method: s.areaUnlocks.method, createdAt: s.areaUnlocks.createdAt }).from(s.areaUnlocks).innerJoin(s.mapAreas, eq(s.mapAreas.id, s.areaUnlocks.areaId)).where(eq(s.areaUnlocks.userId, userId)),
  ]);
  return (
    <div className="space-y-4">
      <AdminCard title="Unlocked areas" bodyClassName="p-0">
        <DataTable rows={areas} rowKey={(r) => r.id} empty="No areas unlocked yet" columns={[{ key: "a", header: "Area", cell: (r) => r.area }, { key: "m", header: "Method", cell: (r) => r.method }, { key: "at", header: "When", cell: (r) => dt(r.createdAt) }]} />
      </AdminCard>
      <AdminCard title="Tile discoveries" bodyClassName="p-0">
        <DataTable
          rows={tiles}
          rowKey={(r) => r.id}
          empty="No discoveries"
          columns={[
            { key: "at", header: "When", cell: (r) => dt(r.createdAt) },
            { key: "a", header: "Area", cell: (r) => r.area },
            { key: "t", header: "Tile", cell: (r) => r.tile },
            { key: "c", header: "Cost", align: "right", cell: (r) => (r.free ? "Free" : formatCredits(r.spent)) },
            { key: "r", header: "Reward", cell: (r) => rewardLabel(r.reward) },
          ]}
        />
      </AdminCard>
    </div>
  );
}

export async function VaultsTab({ userId }: { userId: string }) {
  const rows = await db.select({ id: s.vaultUnlocks.id, vault: s.vaults.name, rewards: s.vaultUnlocks.rewards, consumed: s.vaultUnlocks.consumed, createdAt: s.vaultUnlocks.createdAt }).from(s.vaultUnlocks).innerJoin(s.vaults, eq(s.vaults.id, s.vaultUnlocks.vaultId)).where(eq(s.vaultUnlocks.userId, userId));
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      empty="No vaults unlocked"
      columns={[
        { key: "v", header: "Vault", cell: (r) => r.vault },
        { key: "at", header: "Unlocked", cell: (r) => dt(r.createdAt) },
        { key: "r", header: "Rewards", cell: (r) => (r.rewards as unknown[]).map(rewardLabel).join(", ") },
        { key: "c", header: "Consumed", cell: (r) => <code className="text-xs">{JSON.stringify(r.consumed).slice(0, 80)}</code> },
      ]}
    />
  );
}

export async function CollectionsTab({ userId }: { userId: string }) {
  const rows = await db
    .select({
      id: s.collections.id,
      name: s.collections.name,
      icon: s.collections.icon,
      total: sql<number>`(select count(*)::int from items i where i.collection_id = ${s.collections.id} and i.status = 'PUBLISHED')`,
      owned: sql<number>`(select count(*)::int from inventory inv join items i on i.id = inv.item_id where inv.user_id = ${userId} and i.collection_id = ${s.collections.id} and inv.total_acquired > 0)`,
      completedAt: sql<Date | null>`(select created_at from collection_completions cc where cc.user_id = ${userId} and cc.collection_id = ${s.collections.id})`,
    })
    .from(s.collections)
    .orderBy(s.collections.sortOrder);
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      columns={[
        { key: "n", header: "Collection", cell: (r) => `${r.icon} ${r.name}` },
        { key: "p", header: "Progress", cell: (r) => `${r.owned} / ${r.total}` },
        { key: "c", header: "Completed", cell: (r) => (r.completedAt ? dt(new Date(r.completedAt)) : "-") },
      ]}
    />
  );
}

export async function InventoryTab({ userId }: { userId: string }) {
  const [inv, events] = await Promise.all([
    db.select({ itemId: s.items.id, name: s.items.name, icon: s.items.icon, kind: s.items.kind, rarity: s.items.rarity, qty: s.inventory.quantity, total: s.inventory.totalAcquired }).from(s.inventory).innerJoin(s.items, eq(s.items.id, s.inventory.itemId)).where(eq(s.inventory.userId, userId)).orderBy(s.items.kind, s.items.name),
    db.select({ id: s.inventoryEvents.id, name: s.items.name, delta: s.inventoryEvents.delta, reason: s.inventoryEvents.reason, createdAt: s.inventoryEvents.createdAt }).from(s.inventoryEvents).innerJoin(s.items, eq(s.items.id, s.inventoryEvents.itemId)).where(eq(s.inventoryEvents.userId, userId)).orderBy(desc(s.inventoryEvents.createdAt)).limit(50),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AdminCard title="Holdings" bodyClassName="p-0">
        <DataTable rows={inv} rowKey={(r) => r.itemId} empty="Empty inventory" columns={[{ key: "n", header: "Item", cell: (r) => `${r.icon} ${r.name}` }, { key: "k", header: "Kind", cell: (r) => r.kind }, { key: "r", header: "Rarity", cell: (r) => r.rarity }, { key: "q", header: "Qty", align: "right", cell: (r) => r.qty }, { key: "t", header: "Ever", align: "right", cell: (r) => r.total }]} />
      </AdminCard>
      <AdminCard title="Recent item movements" bodyClassName="p-0">
        <DataTable rows={events} rowKey={(r) => r.id} empty="No movements" columns={[{ key: "at", header: "When", cell: (r) => dt(r.createdAt) }, { key: "n", header: "Item", cell: (r) => r.name }, { key: "d", header: "Change", align: "right", cell: (r) => (r.delta > 0 ? `+${r.delta}` : r.delta) }, { key: "r", header: "Reason", cell: (r) => <span className="text-xs">{r.reason}</span> }]} />
      </AdminCard>
    </div>
  );
}

export async function XpTab({ userId }: { userId: string }) {
  const [tx, ach] = await Promise.all([
    db.select().from(s.xpTransactions).where(eq(s.xpTransactions.userId, userId)).orderBy(desc(s.xpTransactions.createdAt)).limit(100),
    db.select({ id: s.userAchievements.id, name: s.achievements.name, badge: s.achievements.badgeIcon, createdAt: s.userAchievements.createdAt }).from(s.userAchievements).innerJoin(s.achievements, eq(s.achievements.id, s.userAchievements.achievementId)).where(eq(s.userAchievements.userId, userId)),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <AdminCard title="XP history" bodyClassName="p-0">
        <DataTable rows={tx} rowKey={(r) => r.id} empty="No XP yet" columns={[{ key: "at", header: "When", cell: (r) => dt(r.createdAt) }, { key: "s", header: "Source", cell: (r) => r.source.replace(/_/g, " ") }, { key: "a", header: "XP", align: "right", cell: (r) => `+${r.amount}` }]} />
      </AdminCard>
      <AdminCard title="Achievements">
        {ach.length === 0 ? <p className="text-sm text-muted-foreground">None yet</p> : (
          <ul className="space-y-2 text-sm">
            {ach.map((a) => (
              <li key={a.id} className="flex justify-between">
                <span>{a.badge} {a.name}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

export async function GamesTab({ userId }: { userId: string }) {
  const [logins, spins, events] = await Promise.all([
    db.select().from(s.dailyLogins).where(eq(s.dailyLogins.userId, userId)).orderBy(desc(s.dailyLogins.day)).limit(30),
    db.select().from(s.dailySpins).where(eq(s.dailySpins.userId, userId)).orderBy(desc(s.dailySpins.day)).limit(30),
    db.select().from(s.dailyEventClaims).where(eq(s.dailyEventClaims.userId, userId)).orderBy(desc(s.dailyEventClaims.day)).limit(30),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <AdminCard title="Check-ins" bodyClassName="p-0">
        <DataTable rows={logins} rowKey={(r) => r.id} empty="No check-ins" columns={[{ key: "d", header: "Day", cell: (r) => r.day }, { key: "s", header: "Streak", align: "right", cell: (r) => r.streakAfter }]} />
      </AdminCard>
      <AdminCard title="Daily spins" bodyClassName="p-0">
        <DataTable rows={spins} rowKey={(r) => r.id} empty="No spins" columns={[{ key: "d", header: "Day", cell: (r) => r.day }, { key: "r", header: "Reward", cell: (r) => rewardLabel(r.reward) }]} />
      </AdminCard>
      <AdminCard title="Mystery events" bodyClassName="p-0">
        <DataTable rows={events} rowKey={(r) => r.id} empty="No events" columns={[{ key: "d", header: "Day", cell: (r) => r.day }, { key: "r", header: "Reward", cell: (r) => rewardLabel(r.reward) }]} />
      </AdminCard>
    </div>
  );
}

export async function ReferralsTab({ userId, referredById }: { userId: string; referredById: string | null }) {
  const [children, parent, rewards] = await Promise.all([
    db.select({ id: s.profiles.id, name: s.profiles.name, email: s.profiles.email, totalDeposits: s.profiles.totalDeposits, createdAt: s.profiles.createdAt }).from(s.profiles).where(eq(s.profiles.referredById, userId)).orderBy(desc(s.profiles.createdAt)).limit(100),
    referredById ? db.select({ id: s.profiles.id, name: s.profiles.name, email: s.profiles.email }).from(s.profiles).where(eq(s.profiles.id, referredById)).limit(1) : Promise.resolve([]),
    db.select().from(s.cashRewards).where(and(eq(s.cashRewards.userId, userId), sql`${s.cashRewards.source}::text like 'REFERRAL%'`)).orderBy(desc(s.cashRewards.createdAt)).limit(50),
  ]);
  return (
    <div className="space-y-4">
      <AdminCard title="Referred by">{parent[0] ? <UserLink id={parent[0].id} name={parent[0].name} email={parent[0].email} /> : <p className="text-sm text-muted-foreground">Signed up without a referral</p>}</AdminCard>
      <AdminCard title={`Direct referrals (${children.length})`} actions={<Link href={`/admin/referrals/tree?root=${userId}`} className="text-xs font-medium text-primary">Open tree</Link>} bodyClassName="p-0">
        <DataTable rows={children} rowKey={(r) => r.id} empty="No referrals" columns={[{ key: "u", header: "User", cell: (r) => <UserLink id={r.id} name={r.name} email={r.email} /> }, { key: "d", header: "Deposits", align: "right", cell: (r) => formatMYR(r.totalDeposits) }, { key: "j", header: "Joined", cell: (r) => dt(r.createdAt) }]} />
      </AdminCard>
      <AdminCard title="Referral rewards earned" bodyClassName="p-0">
        <DataTable rows={rewards} rowKey={(r) => r.id} empty="No referral rewards" columns={[{ key: "a", header: "Amount", align: "right", cell: (r) => formatMYR(r.amount) }, { key: "l", header: "Level", cell: (r) => `L${r.referralLevel}` }, { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }, { key: "at", header: "When", cell: (r) => dt(r.createdAt) }]} />
      </AdminCard>
    </div>
  );
}

export async function NotificationsTab({ userId }: { userId: string }) {
  const rows = await db.select().from(s.notifications).where(eq(s.notifications.userId, userId)).orderBy(desc(s.notifications.createdAt)).limit(100);
  return <DataTable rows={rows} rowKey={(r) => r.id} empty="No notifications" columns={[{ key: "at", header: "When", cell: (r) => dt(r.createdAt) }, { key: "t", header: "Type", cell: (r) => r.type }, { key: "ti", header: "Title", cell: (r) => r.title }, { key: "b", header: "Message", cell: (r) => <span className="line-clamp-1 text-xs">{r.body}</span> }, { key: "r", header: "Read", cell: (r) => (r.readAt ? "Yes" : "No") }]} />;
}

export async function SupportTab({ userId }: { userId: string }) {
  const [tickets, notes] = await Promise.all([
    db.select().from(s.supportTickets).where(eq(s.supportTickets.userId, userId)).orderBy(desc(s.supportTickets.lastMessageAt)),
    db.select({ id: s.userNotes.id, body: s.userNotes.body, createdAt: s.userNotes.createdAt, author: s.profiles.name }).from(s.userNotes).innerJoin(s.profiles, eq(s.profiles.id, s.userNotes.authorId)).where(eq(s.userNotes.userId, userId)).orderBy(desc(s.userNotes.createdAt)),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AdminCard title="Tickets" bodyClassName="p-0">
        <DataTable rows={tickets} rowKey={(r) => r.id} empty="No tickets" columns={[{ key: "n", header: "#", cell: (r) => <Link href={`/admin/support/${r.id}`} className="text-primary hover:underline">#{r.number}</Link> }, { key: "s", header: "Subject", cell: (r) => r.subject }, { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }]} />
      </AdminCard>
      <AdminCard title="Internal notes">
        {notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes</p> : (
          <ul className="space-y-3 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-muted/50 p-3">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.author} · {formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

export async function SecurityTab({ userId, signupIp, signupDeviceId }: { userId: string; signupIp: string | null; signupDeviceId: string | null }) {
  const [logins, linked] = await Promise.all([
    db.select().from(s.loginEvents).where(eq(s.loginEvents.userId, userId)).orderBy(desc(s.loginEvents.createdAt)).limit(50),
    db
      .select({ id: s.profiles.id, name: s.profiles.name, email: s.profiles.email })
      .from(s.profiles)
      .where(
        and(
          sql`${s.profiles.id} <> ${userId}`,
          or(
            signupDeviceId ? eq(s.profiles.signupDeviceId, signupDeviceId) : sql`false`,
            sql`${s.profiles.id} in (select distinct le2.user_id from login_events le1 join login_events le2 on le2.device_id = le1.device_id and le2.user_id <> le1.user_id where le1.user_id = ${userId} and le1.device_id is not null)`,
          ),
        ),
      )
      .limit(20),
  ]);
  return (
    <div className="space-y-4">
      <AdminCard title="Signup signals">
        <KeyValue items={[["Signup IP", signupIp ?? "-"], ["Signup device", signupDeviceId ? <code className="text-xs">{signupDeviceId}</code> : "-"]]} />
      </AdminCard>
      <AdminCard title="Accounts sharing a device" description="Automated signal only. Review context before acting." bodyClassName="p-0">
        <DataTable rows={linked} rowKey={(r) => r.id} empty="No shared devices found" columns={[{ key: "u", header: "User", cell: (r) => <UserLink id={r.id} name={r.name} email={r.email} /> }]} />
      </AdminCard>
      <AdminCard title="Sign-in history" bodyClassName="p-0">
        <DataTable rows={logins} rowKey={(r) => r.id} empty="No sign-ins recorded" columns={[{ key: "at", header: "When", cell: (r) => dt(r.createdAt) }, { key: "ok", header: "Result", cell: (r) => <StatusBadge status={r.success ? "SUCCESS" : "FAILED"} /> }, { key: "ip", header: "IP", cell: (r) => <code className="text-xs">{r.ip ?? "-"}</code> }, { key: "d", header: "Device", cell: (r) => <code className="text-xs">{r.deviceId?.slice(0, 8) ?? "-"}</code> }, { key: "ua", header: "User agent", cell: (r) => <span className="line-clamp-1 text-xs text-muted-foreground">{r.userAgent}</span> }]} />
      </AdminCard>
    </div>
  );
}

export async function RiskTab({ userId }: { userId: string }) {
  const rows = await db.select().from(s.riskFlags).where(or(eq(s.riskFlags.userId, userId), eq(s.riskFlags.relatedUserId, userId))).orderBy(desc(s.riskFlags.createdAt));
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      empty="No risk signals"
      columns={[
        { key: "at", header: "Raised", cell: (r) => <Link href={`/admin/risk/flags/${r.id}`} className="text-primary hover:underline">{formatDateTime(r.createdAt)}</Link> },
        { key: "t", header: "Signal", cell: (r) => r.type.replace(/_/g, " ") },
        { key: "sv", header: "Severity", cell: (r) => <StatusBadge status={r.severity} tone={r.severity === "HIGH" ? "danger" : r.severity === "MEDIUM" ? "warning" : "neutral"} /> },
        { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        { key: "s", header: "Summary", cell: (r) => <span className="text-xs">{r.summary}</span> },
      ]}
    />
  );
}

export async function AuditTab({ userId }: { userId: string }) {
  const rows = await db.select().from(s.auditLogs).where(or(and(eq(s.auditLogs.entityType, "profile"), eq(s.auditLogs.entityId, userId)), eq(s.auditLogs.actorId, userId))).orderBy(desc(s.auditLogs.id)).limit(100);
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No audit history</p>}
      {rows.map((a) => (
        <details key={a.id} className="rounded-lg border bg-card p-3 text-sm">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2">
            <code className="text-xs font-semibold">{a.action}</code>
            <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
            {a.reason && <span className="text-xs">&ldquo;{a.reason}&rdquo;</span>}
          </summary>
          <div className="mt-2">{a.before || a.after ? <DiffView before={a.before} after={a.after} /> : <JsonBlock value={null} />}</div>
        </details>
      ))}
    </div>
  );
}
