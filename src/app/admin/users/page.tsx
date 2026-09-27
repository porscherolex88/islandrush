import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminPage, DataTable, FilterBar, FilterInput, FilterSelect, Pagination, UserLink, pageOf, str, type Column } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { depositLevels, profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatMYR } from "@/lib/money";
import { ROLES } from "@/lib/permissions";
import { formatDate, relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Users" };
const PAGE = 50;

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin("users.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const conds: SQL[] = [];
  const q = str(sp.q)?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    conds.push(or(ilike(profiles.name, like), ilike(profiles.email, like), ilike(profiles.phone, like), eq(profiles.id, q), eq(profiles.referralCode, q.toUpperCase()))!);
  }
  const status = str(sp.status);
  if (status === "ACTIVE" || status === "SUSPENDED") conds.push(eq(profiles.status, status));
  const role = str(sp.role);
  if (role && ROLES.includes(role as never)) conds.push(eq(profiles.role, role as (typeof ROLES)[number]));
  const ver = str(sp.verification);
  if (ver) conds.push(eq(profiles.verificationStatus, ver as "VERIFIED"));
  const lvl = str(sp.depositLevel);
  if (lvl) conds.push(eq(profiles.depositLevelId, lvl));
  const xpMin = Number(str(sp.xpMin));
  if (xpMin > 0) conds.push(gte(profiles.xpLevel, xpMin));
  const from = str(sp.from);
  if (from) conds.push(gte(profiles.createdAt, new Date(`${from}T00:00:00+08:00`)));
  const to = str(sp.to);
  if (to) conds.push(lte(profiles.createdAt, new Date(`${to}T23:59:59+08:00`)));
  const risk = str(sp.risk);
  if (risk === "flagged") conds.push(sql`exists (select 1 from risk_flags rf where rf.user_id = ${profiles.id} and rf.status in ('OPEN','IN_REVIEW'))`);
  if (risk === "hold") conds.push(eq(profiles.rewardsOnHold, true));
  const activity = str(sp.activity);
  if (activity === "depositors") conds.push(sql`${profiles.totalDeposits} > 0`);
  if (activity === "no-deposit") conds.push(sql`${profiles.totalDeposits} = 0`);
  if (activity === "withdrawers") conds.push(sql`exists (select 1 from withdrawals w where w.user_id = ${profiles.id})`);
  if (activity === "referrers") conds.push(sql`exists (select 1 from profiles c where c.referred_by_id = ${profiles.id})`);

  const sortMap = { createdAt: profiles.createdAt, totalDeposits: profiles.totalDeposits, xpTotal: profiles.xpTotal, lastSeenAt: profiles.lastSeenAt, name: profiles.name } as const;
  const sortKey = (str(sp.sort) ?? "createdAt") as keyof typeof sortMap;
  const col = sortMap[sortKey] ?? profiles.createdAt;
  const order = str(sp.dir) === "asc" ? asc(col) : desc(col);

  const [list, levels] = await Promise.all([
    db
      .select({
        id: profiles.id,
        name: profiles.name,
        email: profiles.email,
        role: profiles.role,
        status: profiles.status,
        verificationStatus: profiles.verificationStatus,
        xpLevel: profiles.xpLevel,
        totalDeposits: profiles.totalDeposits,
        referralCode: profiles.referralCode,
        rewardsOnHold: profiles.rewardsOnHold,
        createdAt: profiles.createdAt,
        lastSeenAt: profiles.lastSeenAt,
        level: depositLevels.name,
        openFlags: sql<number>`(select count(*)::int from risk_flags rf where rf.user_id = ${profiles.id} and rf.status in ('OPEN','IN_REVIEW'))`,
      })
      .from(profiles)
      .leftJoin(depositLevels, eq(depositLevels.id, profiles.depositLevelId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(order)
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE),
    db.select({ value: depositLevels.id, label: depositLevels.name }).from(depositLevels).orderBy(depositLevels.sortOrder),
  ]);
  const rows = list.slice(0, PAGE);
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "user", header: "User", sortKey: "name", cell: (r) => <UserLink id={r.id} name={r.name} email={r.email} /> },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={r.status} />
          {r.role !== "USER" && <StatusBadge status={r.role} tone="brand" />}
          {r.rewardsOnHold && <StatusBadge status="HELD" label="Rewards held" />}
          {r.openFlags > 0 && <StatusBadge status="FLAG" tone="danger" label={`${r.openFlags} flag${r.openFlags > 1 ? "s" : ""}`} />}
        </div>
      ),
    },
    { key: "ver", header: "Verification", cell: (r) => <StatusBadge status={r.verificationStatus} /> },
    { key: "level", header: "Deposit level", cell: (r) => r.level ?? "-" },
    { key: "xp", header: "XP level", sortKey: "xpTotal", align: "right", cell: (r) => r.xpLevel },
    { key: "dep", header: "Total deposits", sortKey: "totalDeposits", align: "right", cell: (r) => formatMYR(r.totalDeposits) },
    { key: "code", header: "Referral code", cell: (r) => <code className="text-xs">{r.referralCode}</code> },
    { key: "joined", header: "Joined", sortKey: "createdAt", cell: (r) => <span className="text-xs whitespace-nowrap">{formatDate(r.createdAt)}</span> },
    { key: "seen", header: "Last seen", sortKey: "lastSeenAt", cell: (r) => <span className="text-xs whitespace-nowrap text-muted-foreground">{r.lastSeenAt ? relativeTime(r.lastSeenAt) : "Never"}</span> },
  ];

  return (
    <AdminPage title="Users" description="Search by name, email, phone, user ID or referral code.">
      <FilterBar basePath="/admin/users">
        <FilterInput name="q" label="Search" value={q} placeholder="Name, email, phone, ID, code" className="min-w-56" />
        <FilterSelect name="status" label="Status" value={status} options={["ACTIVE", "SUSPENDED"]} />
        <FilterSelect name="role" label="Role" value={role} options={ROLES} />
        <FilterSelect name="verification" label="Verification" value={ver} options={["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]} />
        <FilterSelect name="depositLevel" label="Deposit level" value={lvl} options={levels} />
        <FilterInput name="xpMin" label="Min XP level" type="number" value={str(sp.xpMin)} className="w-28" />
        <FilterSelect name="risk" label="Risk" value={risk} options={[{ value: "flagged", label: "Open flags" }, { value: "hold", label: "Rewards on hold" }]} />
        <FilterSelect
          name="activity"
          label="Activity"
          value={activity}
          options={[
            { value: "depositors", label: "Has deposited" },
            { value: "no-deposit", label: "Never deposited" },
            { value: "withdrawers", label: "Has withdrawn" },
            { value: "referrers", label: "Has referrals" },
          ]}
        />
        <FilterInput name="from" label="Joined from" type="date" value={from} />
        <FilterInput name="to" label="Joined to" type="date" value={to} />
      </FilterBar>
      <DataTable rows={rows} columns={columns} sp={sp} basePath="/admin/users" rowKey={(r) => r.id} empty="No users match these filters" />
      <Pagination page={page} hasMore={list.length > PAGE} sp={sp} basePath="/admin/users" />
    </AdminPage>
  );
}
