import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { DEFAULT_TIMEZONE } from "@/lib/time";

export type Range = { from: string; to: string; days: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function kl(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Parses ?from=&to= (inclusive app-days), defaulting to the last 30 days and capping at 366 days. */
export function parseRange(sp: Record<string, string | string[] | undefined>, defaultDays = 30): Range {
  const f = typeof sp.from === "string" && DAY.test(sp.from) ? sp.from : null;
  const t = typeof sp.to === "string" && DAY.test(sp.to) ? sp.to : null;
  const to = t ?? kl(new Date());
  let from = f ?? kl(new Date(Date.now() - (defaultDays - 1) * 86_400_000));
  if (from > to) from = to;
  let days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days > 366) {
    from = kl(new Date(Date.parse(to) - 365 * 86_400_000));
    days = 366;
  }
  return { from, to, days };
}

const TZ = sql.raw(`'${DEFAULT_TIMEZONE}'`);
export const inRange = (col: SQL, r: Range) => sql`(${col} at time zone ${TZ})::date between ${r.from}::date and ${r.to}::date`;

export async function rows<T>(query: SQL): Promise<T[]> {
  const res = await db.execute(query);
  return (res as unknown as { rows: T[] }).rows;
}

export async function one<T>(query: SQL): Promise<T> {
  return (await rows<T>(query))[0];
}

export async function dashboardStats(r: Range) {
  const [users, deposits, withdrawals, balances, credits, games, misc] = await Promise.all([
    one<{ total: number; new: number; active: number }>(sql`
      select count(*)::int as total,
        count(*) filter (where ${inRange(sql`created_at`, r)})::int as new,
        count(*) filter (where ${inRange(sql`last_seen_at`, r)})::int as active
      from profiles where role = 'USER'`),
    one<{ today: string; week: string; month: string; range_sum: string; range_count: number; pending_count: number; pending_sum: string }>(sql`
      select
        coalesce(sum(amount) filter (where status = 'APPROVED' and (reviewed_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date), 0) as today,
        coalesce(sum(amount) filter (where status = 'APPROVED' and reviewed_at > now() - interval '7 days'), 0) as week,
        coalesce(sum(amount) filter (where status = 'APPROVED' and reviewed_at > now() - interval '30 days'), 0) as month,
        coalesce(sum(amount) filter (where status = 'APPROVED' and ${inRange(sql`reviewed_at`, r)}), 0) as range_sum,
        count(*) filter (where status = 'APPROVED' and ${inRange(sql`reviewed_at`, r)})::int as range_count,
        count(*) filter (where status = 'PENDING')::int as pending_count,
        coalesce(sum(amount) filter (where status = 'PENDING'), 0) as pending_sum
      from deposits`),
    one<{ today: string; week: string; month: string; pending_count: number; pending_sum: string }>(sql`
      select
        coalesce(sum(amount) filter (where status = 'COMPLETED' and (completed_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date), 0) as today,
        coalesce(sum(amount) filter (where status = 'COMPLETED' and completed_at > now() - interval '7 days'), 0) as week,
        coalesce(sum(amount) filter (where status = 'COMPLETED' and completed_at > now() - interval '30 days'), 0) as month,
        count(*) filter (where status in ('PENDING','REVIEW','APPROVED','PROCESSING'))::int as pending_count,
        coalesce(sum(amount) filter (where status in ('PENDING','REVIEW','APPROVED','PROCESSING')), 0) as pending_sum
      from withdrawals`),
    one<{ cash: string; credits: string; pending: string; withdrawable: string; withdrawal_pending: string }>(sql`
      select
        coalesce(sum(balance) filter (where type = 'CASH'), 0) as cash,
        coalesce(sum(balance) filter (where type = 'CREDITS'), 0) as credits,
        coalesce(sum(balance) filter (where type = 'PENDING_REWARDS'), 0) as pending,
        coalesce(sum(balance) filter (where type = 'WITHDRAWABLE'), 0) as withdrawable,
        coalesce(sum(balance) filter (where type = 'WITHDRAWAL_PENDING'), 0) as withdrawal_pending
      from financial_accounts where user_id is not null`),
    one<{ issued: string; consumed: string }>(sql`
      select coalesce(sum(amount) filter (where amount > 0), 0) as issued, coalesce(-sum(amount) filter (where amount < 0), 0) as consumed
      from ledger_entries where account_type = 'CREDITS' and user_id is not null and ${inRange(sql`created_at`, r)}`),
    one<{ boxes: number; tiles: number; vaults: number; collections: number; spins: number; areas: number }>(sql`
      select
        (select count(*)::int from mystery_box_plays where ${inRange(sql`created_at`, r)}) as boxes,
        (select count(*)::int from tile_discoveries where ${inRange(sql`created_at`, r)}) as tiles,
        (select count(*)::int from vault_unlocks where ${inRange(sql`created_at`, r)}) as vaults,
        (select count(*)::int from collection_completions where ${inRange(sql`created_at`, r)}) as collections,
        (select count(*)::int from daily_spins where ${inRange(sql`created_at`, r)}) as spins,
        (select count(*)::int from area_unlocks where ${inRange(sql`created_at`, r)}) as areas`),
    one<{ referral_sum: string; referral_count: number; risk_open: number; risk_high: number; tickets_open: number }>(sql`
      select
        (select coalesce(sum(amount), 0) from cash_rewards where source::text like 'REFERRAL%' and status <> 'REVERSED' and ${inRange(sql`created_at`, r)}) as referral_sum,
        (select count(*)::int from cash_rewards where source::text like 'REFERRAL%' and ${inRange(sql`created_at`, r)}) as referral_count,
        (select count(*)::int from risk_flags where status in ('OPEN','IN_REVIEW')) as risk_open,
        (select count(*)::int from risk_flags where status in ('OPEN','IN_REVIEW') and severity = 'HIGH') as risk_high,
        (select count(*)::int from support_tickets where status in ('OPEN','PENDING')) as tickets_open`),
  ]);
  return { users, deposits, withdrawals, balances, credits, games, misc };
}

/** Per-day series over the range with zero-filled days. */
export async function dailySeries(r: Range, source: "users" | "deposits" | "withdrawals" | "boxes" | "tiles" | "dau") {
  const q: Record<typeof source, SQL> = {
    users: sql`select (created_at at time zone ${TZ})::date as d, count(*)::float as v from profiles where role = 'USER' and ${inRange(sql`created_at`, r)} group by 1`,
    deposits: sql`select (reviewed_at at time zone ${TZ})::date as d, sum(amount)::float as v from deposits where status = 'APPROVED' and ${inRange(sql`reviewed_at`, r)} group by 1`,
    withdrawals: sql`select (completed_at at time zone ${TZ})::date as d, sum(amount)::float as v from withdrawals where status = 'COMPLETED' and ${inRange(sql`completed_at`, r)} group by 1`,
    boxes: sql`select app_day as d, count(*)::float as v from mystery_box_plays where app_day between ${r.from}::date and ${r.to}::date group by 1`,
    tiles: sql`select app_day as d, count(*)::float as v from tile_discoveries where app_day between ${r.from}::date and ${r.to}::date group by 1`,
    dau: sql`select day as d, count(*)::float as v from daily_logins where day between ${r.from}::date and ${r.to}::date group by 1`,
  };
  const data = await rows<{ d: string | Date; v: number }>(q[source]);
  const map = new Map(data.map((x) => [typeof x.d === "string" ? x.d.slice(0, 10) : kl(x.d), Number(x.v)]));
  const out: { label: string; value: number }[] = [];
  for (let i = 0; i < r.days; i++) {
    const day = new Date(Date.parse(r.from) + i * 86_400_000).toISOString().slice(0, 10);
    out.push({ label: day.slice(5), value: map.get(day) ?? 0 });
  }
  return out;
}
