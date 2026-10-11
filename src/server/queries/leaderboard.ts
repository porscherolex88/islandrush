import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { maskName } from "@/lib/mask-name";

export type LeaderboardRow = { rank: number; name: string; score: number; isMe: boolean };
export type Leaderboard = { top: LeaderboardRow[]; me: LeaderboardRow | null };

const TOP = 10;

type RawRow = { id: string; name: string; score: number; rank: number };

function shape(rows: RawRow[], userId: string): Leaderboard {
  const toRow = (r: RawRow): LeaderboardRow => ({ rank: Number(r.rank), name: r.id === userId ? "You" : maskName(r.name), score: Number(r.score), isMe: r.id === userId });
  const top = rows.filter((r) => Number(r.rank) <= TOP).map(toRow);
  const mine = rows.find((r) => r.id === userId);
  return { top, me: mine ? toRow(mine) : null };
}

/** Players ranked by every piece of Loot they have ever found (selling Loot doesn't lower it). */
async function lootBoard(userId: string) {
  const res = await db.execute<RawRow>(sql`
    with scores as (
      select p.id, p.name, coalesce(sum(inv.total_acquired), 0)::int as score
      from profiles p
      join inventory inv on inv.user_id = p.id
      join items it on it.id = inv.item_id and it.kind = 'LOOT'
      where p.role = 'USER' and p.status = 'ACTIVE'
      group by p.id, p.name
    ),
    ranked as (
      select id, name, score, (row_number() over (order by score desc, name asc))::int as rank
      from scores where score > 0
    )
    select id, name, score, rank from ranked where rank <= ${TOP} or id = ${userId} order by rank
  `);
  return shape(res.rows, userId);
}

/** Players ranked by their current daily check-in streak. Streaks that lapsed before yesterday don't count. */
async function streakBoard(userId: string) {
  const res = await db.execute<RawRow>(sql`
    with ranked as (
      select p.id, p.name, s.current as score, (row_number() over (order by s.current desc, s.longest desc, p.name asc))::int as rank
      from profiles p
      join user_streaks s on s.user_id = p.id
      where p.role = 'USER' and p.status = 'ACTIVE' and s.current > 0 and s.last_claim_day >= current_date - 1
    )
    select id, name, score, rank from ranked where rank <= ${TOP} or id = ${userId} order by rank
  `);
  return shape(res.rows, userId);
}

export async function getLeaderboards(userId: string) {
  const [loot, streak] = await Promise.all([lootBoard(userId), streakBoard(userId)]);
  return { loot, streak };
}

export type Leaderboards = Awaited<ReturnType<typeof getLeaderboards>>;
