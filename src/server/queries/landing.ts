import "server-only";
import { and, asc, count, desc, eq, isNotNull, ne } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { isDatabaseConfigured } from "@/db/env";
import { bigBoxOpenings, mapCheckpoints, maps, mysteryBoxes, mysteryBoxPlays, prizeClaims, profiles } from "@/db/schema";
import { maskName } from "@/lib/mask-name";

export type ActivityKind = "box" | "bigbox" | "prize";

export type LandingActivity = {
  id: string;
  kind: ActivityKind;
  player: string;
  level: number | null;
  /** Box or prize name. Never an amount. */
  detail: string | null;
  at: string;
};

export type LandingStats = { boxesOpened: number; prizesUnlocked: number; players: number };

/** Below this many events the live ticker hides instead of looking empty. */
export const MIN_ACTIVITY = 5;
/** Below this many distinct masked names the ticker hides so one player cannot dominate. */
export const MIN_UNIQUE_PLAYERS = 3;
/** Cap how many events any single player contributes to the public ticker. */
const MAX_PER_PLAYER = 2;

const PUBLIC_PLAYER = and(eq(profiles.role, "USER"), eq(profiles.status, "ACTIVE"));

/** Latest box openings, Big Box openings and prize unlocks from real players, anonymised. */
export async function loadRecentActivity(limit = 20): Promise<LandingActivity[]> {
  if (!isDatabaseConfigured()) return [];
  const fetchLimit = Math.max(limit * 4, 40);
  const [boxes, bigBoxes, claims] = await Promise.all([
    db
      .select({ id: mysteryBoxPlays.id, name: profiles.name, level: mysteryBoxPlays.level, detail: mysteryBoxes.name, at: mysteryBoxPlays.createdAt })
      .from(mysteryBoxPlays)
      .innerJoin(profiles, eq(profiles.id, mysteryBoxPlays.userId))
      .innerJoin(mysteryBoxes, eq(mysteryBoxes.id, mysteryBoxPlays.boxId))
      .where(PUBLIC_PLAYER)
      .orderBy(desc(mysteryBoxPlays.createdAt))
      .limit(fetchLimit),
    db
      .select({ id: bigBoxOpenings.id, name: profiles.name, level: bigBoxOpenings.level, pieces: bigBoxOpenings.pieces, at: bigBoxOpenings.createdAt })
      .from(bigBoxOpenings)
      .innerJoin(profiles, eq(profiles.id, bigBoxOpenings.userId))
      .where(PUBLIC_PLAYER)
      .orderBy(desc(bigBoxOpenings.createdAt))
      .limit(fetchLimit),
    db
      .select({ id: prizeClaims.id, name: profiles.name, level: prizeClaims.level, snapshot: prizeClaims.prizeSnapshot, at: prizeClaims.createdAt })
      .from(prizeClaims)
      .innerJoin(profiles, eq(profiles.id, prizeClaims.userId))
      .where(and(PUBLIC_PLAYER, ne(prizeClaims.status, "REJECTED")))
      .orderBy(desc(prizeClaims.createdAt))
      .limit(fetchLimit),
  ]);

  const events: LandingActivity[] = [
    ...boxes.map((r) => ({ id: `b_${r.id}`, kind: "box" as const, player: maskName(r.name), level: r.level, detail: r.detail, at: r.at.toISOString() })),
    ...bigBoxes.map((r) => ({
      id: `g_${r.id}`,
      kind: "bigbox" as const,
      player: maskName(r.name),
      level: r.level,
      detail: `${r.pieces} puzzle ${r.pieces === 1 ? "piece" : "pieces"}`,
      at: r.at.toISOString(),
    })),
    ...claims.map((r) => ({
      id: `p_${r.id}`,
      kind: "prize" as const,
      player: maskName(r.name),
      level: r.level,
      detail: typeof r.snapshot?.name === "string" ? r.snapshot.name : null,
      at: r.at.toISOString(),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const perPlayer = new Map<string, number>();
  const diversified: LandingActivity[] = [];
  for (const e of events) {
    const n = perPlayer.get(e.player) ?? 0;
    if (n >= MAX_PER_PLAYER) continue;
    perPlayer.set(e.player, n + 1);
    diversified.push(e);
    if (diversified.length >= limit) break;
  }
  return diversified;
}

/** True when the ticker has enough real, varied activity to show without looking fake. */
export function activityReady(events: LandingActivity[]) {
  if (events.length < MIN_ACTIVITY) return false;
  const unique = new Set(events.map((e) => e.player));
  return unique.size >= MIN_UNIQUE_PLAYERS;
}

export async function loadLandingStats(): Promise<LandingStats> {
  if (!isDatabaseConfigured()) return { boxesOpened: 0, prizesUnlocked: 0, players: 0 };
  const [[boxes], [prizes], [players]] = await Promise.all([
    db.select({ n: count() }).from(mysteryBoxPlays),
    db.select({ n: count() }).from(prizeClaims).where(ne(prizeClaims.status, "REJECTED")),
    db.select({ n: count() }).from(profiles).where(PUBLIC_PLAYER),
  ]);
  return { boxesOpened: boxes?.n ?? 0, prizesUnlocked: prizes?.n ?? 0, players: players?.n ?? 0 };
}

export type LandingMap = { level: number; name: string; artwork: string | null; lootRequired: number; checkpoints: number };

/** Published adventure maps, one per level, for the public level showcase. */
export async function loadLandingMaps(): Promise<LandingMap[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await db
    .select({ level: maps.level, name: maps.name, artwork: maps.artwork, lootRequired: maps.lootRequired, checkpoints: count(mapCheckpoints.id) })
    .from(maps)
    .leftJoin(mapCheckpoints, eq(mapCheckpoints.mapId, maps.id))
    .where(and(isNotNull(maps.level), eq(maps.status, "PUBLISHED")))
    .groupBy(maps.id)
    .orderBy(asc(maps.level));
  return rows.map((r) => ({ ...r, level: r.level ?? 0 }));
}

export const landingMaps = unstable_cache(loadLandingMaps, ["landing-maps"], { revalidate: 600 });
export const recentActivity = unstable_cache(loadRecentActivity, ["landing-activity"], { revalidate: 60 });
export const landingStats = unstable_cache(loadLandingStats, ["landing-stats"], { revalidate: 300 });
