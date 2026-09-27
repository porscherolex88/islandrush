import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { Permission } from "@/lib/permissions";
import { inRange, type Range } from "./queries";

export type ReportFormat = "text" | "int" | "money" | "credits" | "date" | "datetime" | "pct";
export type ReportColumn = { key: string; label: string; format?: ReportFormat };
export type ReportGroup = "finance" | "users" | "games" | "collections" | "referrals" | "retention";

export type ReportDef = {
  key: string;
  group: ReportGroup;
  label: string;
  description: string;
  permission: Permission;
  columns: ReportColumn[];
  statuses?: readonly string[];
  /** Must end with a deterministic ORDER BY so offset pagination and chunked exports are stable. */
  query: (r: Range, f: { status?: string }) => SQL;
};

export const REPORT_GROUPS: { key: ReportGroup; label: string }[] = [
  { key: "finance", label: "Financial" },
  { key: "users", label: "Users" },
  { key: "games", label: "Games" },
  { key: "collections", label: "Rewards and collections" },
  { key: "referrals", label: "Referrals" },
  { key: "retention", label: "Retention" },
];

const day = (col: SQL) => sql`(${col} at time zone 'Asia/Kuala_Lumpur')::date`;
const days = (r: Range) => sql`generate_series(${r.from}::date, ${r.to}::date, interval '1 day')::date`;
const statusIs = (col: SQL, status: string | undefined, allowed: readonly string[]) => (status && allowed.includes(status) ? sql`and ${col}::text = ${status}` : sql``);

const DEPOSIT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "REVERSED"] as const;
const WITHDRAWAL_STATUSES = ["PENDING", "REVIEW", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"] as const;
const REWARD_STATUSES = ["PENDING", "HELD", "SETTLED", "REVERSED"] as const;

export const REPORTS: ReportDef[] = [
  /* --------------------------------- Finance -------------------------------- */
  {
    key: "deposits",
    group: "finance",
    label: "Deposits",
    description: "Every deposit submitted in the period.",
    permission: "finance.view",
    statuses: DEPOSIT_STATUSES,
    columns: [
      { key: "submitted", label: "Submitted", format: "datetime" },
      { key: "email", label: "User" },
      { key: "amount", label: "Amount", format: "money" },
      { key: "method", label: "Method" },
      { key: "reference", label: "Reference" },
      { key: "status", label: "Status" },
      { key: "reviewed", label: "Reviewed", format: "datetime" },
    ],
    query: (r, f) => sql`
      select d.created_at as submitted, p.email, d.amount, d.method, d.reference, d.status::text as status, d.reviewed_at as reviewed
      from deposits d join profiles p on p.id = d.user_id
      where ${inRange(sql`d.created_at`, r)} ${statusIs(sql`d.status`, f.status, DEPOSIT_STATUSES)}
      order by d.created_at, d.id`,
  },
  {
    key: "withdrawals",
    group: "finance",
    label: "Withdrawals",
    description: "Every withdrawal requested in the period.",
    permission: "finance.view",
    statuses: WITHDRAWAL_STATUSES,
    columns: [
      { key: "requested", label: "Requested", format: "datetime" },
      { key: "email", label: "User" },
      { key: "amount", label: "Amount", format: "money" },
      { key: "bank", label: "Bank" },
      { key: "status", label: "Status" },
      { key: "payout_reference", label: "Payout reference" },
      { key: "completed", label: "Completed", format: "datetime" },
    ],
    query: (r, f) => sql`
      select w.created_at as requested, p.email, w.amount, w.account_snapshot->>'bankName' as bank, w.status::text as status, w.payout_reference, w.completed_at as completed
      from withdrawals w join profiles p on p.id = w.user_id
      where ${inRange(sql`w.created_at`, r)} ${statusIs(sql`w.status`, f.status, WITHDRAWAL_STATUSES)}
      order by w.created_at, w.id`,
  },
  {
    key: "ledger",
    group: "finance",
    label: "Ledger",
    description: "Double-entry ledger lines posted in the period.",
    permission: "finance.view",
    columns: [
      { key: "posted", label: "Posted", format: "datetime" },
      { key: "tx", label: "Transaction" },
      { key: "type", label: "Type" },
      { key: "owner", label: "Owner" },
      { key: "account", label: "Account" },
      { key: "currency", label: "Currency" },
      { key: "amount", label: "Amount" },
      { key: "description", label: "Description" },
    ],
    query: (r) => sql`
      select e.created_at as posted, t.id::text as tx, t.type::text as type, coalesce(p.email, 'System') as owner, a.type::text as account, a.currency::text as currency, e.amount::text as amount, t.description
      from ledger_entries e
      join ledger_transactions t on t.id = e.transaction_id
      join financial_accounts a on a.id = e.account_id
      left join profiles p on p.id = a.user_id
      where ${inRange(sql`e.created_at`, r)}
      order by e.created_at, e.id`,
  },
  {
    key: "reward-liability",
    group: "finance",
    label: "Reward liability",
    description: "Cash rewards created, settled and reversed per day, with pending liability at end of day.",
    permission: "finance.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "created", label: "Created", format: "money" },
      { key: "settled", label: "Settled", format: "money" },
      { key: "reversed", label: "Reversed", format: "money" },
      { key: "outstanding", label: "Outstanding (pending + held)", format: "money" },
    ],
    query: (r) => sql`
      select d as day,
        coalesce((select sum(amount) from cash_rewards where ${day(sql`created_at`)} = d), 0) as created,
        coalesce((select sum(amount) from cash_rewards where status = 'SETTLED' and ${day(sql`settled_at`)} = d), 0) as settled,
        coalesce((select sum(amount) from cash_rewards where status = 'REVERSED' and ${day(sql`updated_at`)} = d), 0) as reversed,
        coalesce((select sum(amount) from cash_rewards where ${day(sql`created_at`)} <= d
          and not (status = 'SETTLED' and ${day(sql`settled_at`)} <= d)
          and not (status = 'REVERSED' and ${day(sql`updated_at`)} <= d)), 0) as outstanding
      from ${days(r)} d order by d`,
  },
  {
    key: "credit-activity",
    group: "finance",
    label: "Credit activity",
    description: "Credits purchased, spent in games and issued as rewards per day.",
    permission: "finance.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "purchased", label: "Purchased", format: "credits" },
      { key: "cash", label: "Cash converted", format: "money" },
      { key: "spent", label: "Spent", format: "credits" },
      { key: "rewarded", label: "Rewarded", format: "credits" },
    ],
    query: (r) => sql`
      select d as day,
        coalesce((select sum(credits) from conversions where ${day(sql`created_at`)} = d), 0) as purchased,
        coalesce((select sum(cash_amount) from conversions where ${day(sql`created_at`)} = d), 0) as cash,
        coalesce((select -sum(e.amount) from ledger_entries e join ledger_transactions t on t.id = e.transaction_id where t.type = 'GAME_SPEND' and e.user_id is not null and ${day(sql`e.created_at`)} = d), 0) as spent,
        coalesce((select sum(e.amount) from ledger_entries e join ledger_transactions t on t.id = e.transaction_id where t.type = 'GAME_REWARD_CREDITS' and e.user_id is not null and ${day(sql`e.created_at`)} = d), 0) as rewarded
      from ${days(r)} d order by d`,
  },
  /* ---------------------------------- Users --------------------------------- */
  {
    key: "registrations",
    group: "users",
    label: "Registrations",
    description: "New accounts per day and how many have deposited since.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "signups", label: "Signups", format: "int" },
      { key: "referred", label: "Referred", format: "int" },
      { key: "depositors", label: "Have deposited", format: "int" },
      { key: "conversion", label: "Deposit rate", format: "pct" },
    ],
    query: (r) => sql`
      select d as day, count(p.id)::int as signups, count(p.referred_by_id)::int as referred,
        count(p.id) filter (where p.total_deposits > 0)::int as depositors,
        coalesce(100.0 * count(p.id) filter (where p.total_deposits > 0) / nullif(count(p.id), 0), 0)::float as conversion
      from ${days(r)} d left join profiles p on ${day(sql`p.created_at`)} = d and p.role = 'USER'
      group by d order by d`,
  },
  {
    key: "activity",
    group: "users",
    label: "Activity",
    description: "Daily check-ins and game actions.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "checkins", label: "Check-ins", format: "int" },
      { key: "boxes", label: "Box opens", format: "int" },
      { key: "tiles", label: "Discoveries", format: "int" },
      { key: "logins", label: "Successful logins", format: "int" },
    ],
    query: (r) => sql`
      select d as day,
        (select count(*)::int from daily_logins where day = d) as checkins,
        (select count(*)::int from mystery_box_plays where app_day = d) as boxes,
        (select count(*)::int from tile_discoveries where app_day = d) as tiles,
        (select count(*)::int from login_events where success and ${day(sql`created_at`)} = d) as logins
      from ${days(r)} d order by d`,
  },
  {
    key: "verification",
    group: "users",
    label: "Verification",
    description: "Accounts with a verification status or requirement (all time).",
    permission: "users.view",
    statuses: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"],
    columns: [
      { key: "email", label: "User" },
      { key: "status", label: "Status" },
      { key: "required", label: "Required" },
      { key: "note", label: "Note" },
      { key: "joined", label: "Joined", format: "date" },
    ],
    query: (_r, f) => sql`
      select email, verification_status::text as status, case when verification_required then 'Yes' else 'No' end as required, verification_note as note, created_at as joined
      from profiles where role = 'USER' and (verification_status <> 'UNVERIFIED' or verification_required)
      ${statusIs(sql`verification_status`, f.status, ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"])}
      order by created_at, id`,
  },
  {
    key: "deposit-levels",
    group: "users",
    label: "Deposit Levels",
    description: "Current distribution of players by Deposit Level.",
    permission: "reports.view",
    columns: [
      { key: "level", label: "Level" },
      { key: "threshold", label: "Threshold", format: "money" },
      { key: "players", label: "Players", format: "int" },
      { key: "deposits", label: "Lifetime deposits", format: "money" },
    ],
    query: () => sql`
      select coalesce(l.name, 'No level') as level, l.threshold, count(p.id)::int as players, coalesce(sum(p.total_deposits), 0) as deposits
      from profiles p left join deposit_levels l on l.id = p.deposit_level_id
      where p.role = 'USER' group by l.name, l.threshold, l.sort_order order by l.sort_order nulls first`,
  },
  {
    key: "xp-levels",
    group: "users",
    label: "XP Levels",
    description: "Current distribution of players by XP level.",
    permission: "reports.view",
    columns: [
      { key: "level", label: "Level", format: "int" },
      { key: "title", label: "Title" },
      { key: "players", label: "Players", format: "int" },
      { key: "avg_xp", label: "Average XP", format: "int" },
    ],
    query: () => sql`
      select p.xp_level as level, coalesce(l.title, '') as title, count(*)::int as players, round(avg(p.xp_total))::int as avg_xp
      from profiles p left join xp_levels l on l.level = p.xp_level
      where p.role = 'USER' group by p.xp_level, l.title order by p.xp_level`,
  },
  /* ---------------------------------- Games --------------------------------- */
  {
    key: "mystery-box",
    group: "games",
    label: "Mystery Box activity",
    description: "Opens, players and Credits spent per box per day.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "box", label: "Box" },
      { key: "opens", label: "Opens", format: "int" },
      { key: "players", label: "Players", format: "int" },
      { key: "spent", label: "Credits spent", format: "credits" },
    ],
    query: (r) => sql`
      select p.app_day as day, b.name as box, count(*)::int as opens, count(distinct p.user_id)::int as players, sum(p.credits_spent) as spent
      from mystery_box_plays p join mystery_boxes b on b.id = p.box_id
      where p.app_day between ${r.from}::date and ${r.to}::date
      group by p.app_day, b.name order by p.app_day, b.name`,
  },
  {
    key: "map",
    group: "games",
    label: "Map discoveries",
    description: "Discoveries per area per day.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "area", label: "Area" },
      { key: "discoveries", label: "Discoveries", format: "int" },
      { key: "free", label: "Free", format: "int" },
      { key: "players", label: "Players", format: "int" },
      { key: "spent", label: "Credits spent", format: "credits" },
    ],
    query: (r) => sql`
      select t.app_day as day, a.name as area, count(*)::int as discoveries, count(*) filter (where t.used_free_discovery)::int as free,
        count(distinct t.user_id)::int as players, sum(t.credits_spent) as spent
      from tile_discoveries t join map_areas a on a.id = t.area_id
      where t.app_day between ${r.from}::date and ${r.to}::date
      group by t.app_day, a.name order by t.app_day, a.name`,
  },
  {
    key: "vaults",
    group: "games",
    label: "Vault unlocks",
    description: "Every vault unlock in the period.",
    permission: "reports.view",
    columns: [
      { key: "unlocked", label: "Unlocked", format: "datetime" },
      { key: "vault", label: "Vault" },
      { key: "email", label: "User" },
      { key: "rewards", label: "Rewards", format: "int" },
    ],
    query: (r) => sql`
      select u.created_at as unlocked, v.name as vault, p.email, jsonb_array_length(u.rewards) as rewards
      from vault_unlocks u join vaults v on v.id = u.vault_id join profiles p on p.id = u.user_id
      where ${inRange(sql`u.created_at`, r)} order by u.created_at, u.id`,
  },
  {
    key: "daily",
    group: "games",
    label: "Daily activity",
    description: "Check-ins, spins, mission bonuses and Mystery events per day.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "checkins", label: "Check-ins", format: "int" },
      { key: "spins", label: "Spins", format: "int" },
      { key: "bonuses", label: "Mission bonuses", format: "int" },
      { key: "events", label: "Event plays", format: "int" },
      { key: "event_spent", label: "Event Credits", format: "credits" },
    ],
    query: (r) => sql`
      select d as day,
        (select count(*)::int from daily_logins where day = d) as checkins,
        (select count(*)::int from daily_spins where day = d) as spins,
        (select count(*)::int from mission_bonus_claims where day = d) as bonuses,
        (select count(*)::int from daily_event_claims where day = d) as events,
        (select coalesce(sum(credits_spent), 0) from daily_event_claims where day = d) as event_spent
      from ${days(r)} d order by d`,
  },
  /* ------------------------------- Collections ------------------------------ */
  {
    key: "collection-starts",
    group: "collections",
    label: "Collection starts",
    description: "Players who acquired their first item of each collection in the period.",
    permission: "reports.view",
    columns: [
      { key: "collection", label: "Collection" },
      { key: "starts", label: "New collectors", format: "int" },
      { key: "total", label: "All-time collectors", format: "int" },
    ],
    query: (r) => sql`
      select c.name as collection,
        count(*) filter (where ${day(sql`x.first_at`)} between ${r.from}::date and ${r.to}::date)::int as starts,
        count(x.user_id)::int as total
      from collections c left join (
        select i.collection_id, inv.user_id, min(inv.first_acquired_at) as first_at
        from inventory inv join items i on i.id = inv.item_id where i.collection_id is not null
        group by i.collection_id, inv.user_id
      ) x on x.collection_id = c.id
      group by c.id, c.name, c.sort_order order by c.sort_order, c.name`,
  },
  {
    key: "collection-completions",
    group: "collections",
    label: "Completions",
    description: "Every collection completion in the period.",
    permission: "reports.view",
    columns: [
      { key: "completed", label: "Completed", format: "datetime" },
      { key: "collection", label: "Collection" },
      { key: "email", label: "User" },
      { key: "rewards", label: "Rewards", format: "int" },
    ],
    query: (r) => sql`
      select cc.created_at as completed, c.name as collection, p.email, jsonb_array_length(cc.rewards) as rewards
      from collection_completions cc join collections c on c.id = cc.collection_id join profiles p on p.id = cc.user_id
      where ${inRange(sql`cc.created_at`, r)} order by cc.created_at, cc.id`,
  },
  {
    key: "item-acquisition",
    group: "collections",
    label: "Item acquisition",
    description: "Items granted and consumed in the period.",
    permission: "reports.view",
    columns: [
      { key: "item", label: "Item" },
      { key: "kind", label: "Kind" },
      { key: "rarity", label: "Rarity" },
      { key: "granted", label: "Granted", format: "int" },
      { key: "consumed", label: "Consumed", format: "int" },
      { key: "players", label: "Players", format: "int" },
    ],
    query: (r) => sql`
      select i.name as item, i.kind::text as kind, i.rarity::text as rarity,
        coalesce(sum(e.delta) filter (where e.delta > 0), 0)::int as granted,
        coalesce(-sum(e.delta) filter (where e.delta < 0), 0)::int as consumed,
        count(distinct e.user_id)::int as players
      from items i join inventory_events e on e.item_id = i.id and ${inRange(sql`e.created_at`, r)}
      group by i.id, i.name, i.kind, i.rarity order by granted desc, i.name`,
  },
  /* -------------------------------- Referrals ------------------------------- */
  {
    key: "referral-registrations",
    group: "referrals",
    label: "Referral registrations",
    description: "Accounts that signed up with a referral code.",
    permission: "referrals.view",
    columns: [
      { key: "joined", label: "Joined", format: "datetime" },
      { key: "email", label: "Referee" },
      { key: "referrer", label: "Referrer" },
      { key: "deposits", label: "Lifetime deposits", format: "money" },
    ],
    query: (r) => sql`
      select p.created_at as joined, p.email, rp.email as referrer, p.total_deposits as deposits
      from profiles p join profiles rp on rp.id = p.referred_by_id
      where ${inRange(sql`p.created_at`, r)} order by p.created_at, p.id`,
  },
  {
    key: "referral-qualifying",
    group: "referrals",
    label: "Qualifying deposits",
    description: "Deposits that generated referral rewards.",
    permission: "referrals.view",
    columns: [
      { key: "approved", label: "Approved", format: "datetime" },
      { key: "referee", label: "Referee" },
      { key: "amount", label: "Deposit", format: "money" },
      { key: "rewards", label: "Rewards", format: "money" },
      { key: "levels", label: "Levels paid", format: "int" },
    ],
    query: (r) => sql`
      select d.reviewed_at as approved, p.email as referee, d.amount,
        (select coalesce(sum(amount), 0) from cash_rewards c where c.deposit_id = d.id and c.status <> 'REVERSED') as rewards,
        (select count(*)::int from cash_rewards c where c.deposit_id = d.id) as levels
      from deposits d join profiles p on p.id = d.user_id
      where exists (select 1 from cash_rewards c where c.deposit_id = d.id) and ${inRange(sql`d.reviewed_at`, r)}
      order by d.reviewed_at, d.id`,
  },
  {
    key: "referral-rewards",
    group: "referrals",
    label: "Referral rewards",
    description: "Referral rewards created in the period.",
    permission: "referrals.view",
    statuses: REWARD_STATUSES,
    columns: [
      { key: "created", label: "Created", format: "datetime" },
      { key: "referrer", label: "Referrer" },
      { key: "referee", label: "Referee" },
      { key: "level", label: "Level", format: "int" },
      { key: "amount", label: "Amount", format: "money" },
      { key: "status", label: "Status" },
    ],
    query: (r, f) => sql`
      select c.created_at as created, u.email as referrer, e.email as referee, c.referral_level as level, c.amount, c.status::text as status
      from cash_rewards c join profiles u on u.id = c.user_id left join profiles e on e.id = c.referee_id
      where c.source::text like 'REFERRAL%' and ${inRange(sql`c.created_at`, r)} ${statusIs(sql`c.status`, f.status, REWARD_STATUSES)}
      order by c.created_at, c.id`,
  },
  {
    key: "referral-reversals",
    group: "referrals",
    label: "Reversals",
    description: "Referral rewards reversed in the period.",
    permission: "referrals.view",
    columns: [
      { key: "reversed", label: "Reversed", format: "datetime" },
      { key: "referrer", label: "Referrer" },
      { key: "level", label: "Level", format: "int" },
      { key: "amount", label: "Amount", format: "money" },
      { key: "reason", label: "Reason" },
    ],
    query: (r) => sql`
      select c.updated_at as reversed, u.email as referrer, c.referral_level as level, c.amount, c.held_reason as reason
      from cash_rewards c join profiles u on u.id = c.user_id
      where c.source::text like 'REFERRAL%' and c.status = 'REVERSED' and ${inRange(sql`c.updated_at`, r)}
      order by c.updated_at, c.id`,
  },
  /* -------------------------------- Retention ------------------------------- */
  {
    key: "dau",
    group: "retention",
    label: "Daily active users",
    description: "Players who checked in, split into new and returning.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "dau", label: "Active", format: "int" },
      { key: "new", label: "New", format: "int" },
      { key: "returning", label: "Returning", format: "int" },
      { key: "wau", label: "Active last 7 days", format: "int" },
    ],
    query: (r) => sql`
      select d as day,
        (select count(*)::int from daily_logins l where l.day = d) as dau,
        (select count(*)::int from daily_logins l join profiles p on p.id = l.user_id where l.day = d and ${day(sql`p.created_at`)} = d) as new,
        (select count(*)::int from daily_logins l join profiles p on p.id = l.user_id where l.day = d and ${day(sql`p.created_at`)} < d) as returning,
        (select count(distinct user_id)::int from daily_logins l where l.day between d - 6 and d) as wau
      from ${days(r)} d order by d`,
  },
  {
    key: "returning",
    group: "retention",
    label: "Returning users",
    description: "Of players who signed up each day, how many came back later.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Signup day", format: "date" },
      { key: "signups", label: "Signups", format: "int" },
      { key: "d1", label: "Day 1", format: "pct" },
      { key: "d7", label: "Day 7", format: "pct" },
      { key: "d30", label: "Day 30", format: "pct" },
    ],
    query: (r) => sql`
      with cohort as (select id, ${day(sql`created_at`)} as joined from profiles where role = 'USER' and ${inRange(sql`created_at`, r)})
      select c.joined as day, count(*)::int as signups,
        coalesce(100.0 * count(*) filter (where exists (select 1 from daily_logins l where l.user_id = c.id and l.day = c.joined + 1)) / nullif(count(*), 0), 0)::float as d1,
        coalesce(100.0 * count(*) filter (where exists (select 1 from daily_logins l where l.user_id = c.id and l.day = c.joined + 7)) / nullif(count(*), 0), 0)::float as d7,
        coalesce(100.0 * count(*) filter (where exists (select 1 from daily_logins l where l.user_id = c.id and l.day = c.joined + 30)) / nullif(count(*), 0), 0)::float as d30
      from cohort c group by c.joined order by c.joined`,
  },
  {
    key: "streaks",
    group: "retention",
    label: "Streak distribution",
    description: "Current check-in streaks across players.",
    permission: "reports.view",
    columns: [
      { key: "bucket", label: "Current streak" },
      { key: "players", label: "Players", format: "int" },
    ],
    query: () => sql`
      select bucket, players from (
        select case when current = 0 then '0 days' when current between 1 and 2 then '1-2 days' when current between 3 and 6 then '3-6 days'
          when current between 7 and 13 then '7-13 days' when current between 14 and 29 then '14-29 days' else '30+ days' end as bucket,
          min(current) as sort, count(*)::int as players
        from user_streaks group by 1
      ) x order by sort`,
  },
  {
    key: "missions",
    group: "retention",
    label: "Mission completion",
    description: "Mission completions and full-set bonuses per day.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "players", label: "Players with progress", format: "int" },
      { key: "completed", label: "Missions completed", format: "int" },
      { key: "bonuses", label: "All 3 completed", format: "int" },
    ],
    query: (r) => sql`
      select d as day,
        (select count(distinct user_id)::int from mission_progress where day = d) as players,
        (select count(*)::int from mission_progress where day = d and completed_at is not null) as completed,
        (select count(*)::int from mission_bonus_claims where day = d) as bonuses
      from ${days(r)} d order by d`,
  },
  {
    key: "engagement",
    group: "retention",
    label: "Game engagement",
    description: "Unique players per game per day.",
    permission: "reports.view",
    columns: [
      { key: "day", label: "Day", format: "date" },
      { key: "box_players", label: "Mystery Box", format: "int" },
      { key: "map_players", label: "Map", format: "int" },
      { key: "spin_players", label: "Daily Spin", format: "int" },
      { key: "event_players", label: "Mystery events", format: "int" },
    ],
    query: (r) => sql`
      select d as day,
        (select count(distinct user_id)::int from mystery_box_plays where app_day = d) as box_players,
        (select count(distinct user_id)::int from tile_discoveries where app_day = d) as map_players,
        (select count(distinct user_id)::int from daily_spins where day = d) as spin_players,
        (select count(distinct user_id)::int from daily_event_claims where day = d) as event_players
      from ${days(r)} d order by d`,
  },
];

export function getReport(key: string | undefined) {
  return REPORTS.find((r) => r.key === key) ?? null;
}

export function reportPage(def: ReportDef, r: Range, f: { status?: string }, limit: number, offset: number) {
  return sql`${def.query(r, f)} limit ${limit} offset ${offset}`;
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvLine(values: unknown[]) {
  return `${values.map(csvCell).join(",")}\r\n`;
}
