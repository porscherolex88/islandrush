import { randomInt, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, type DbOrTx, type Tx } from "@/db";
import {
  bigBoxOpenings,
  boxJackpots,
  freeBoxPlays,
  bigMysteryBoxes,
  inventory,
  items,
  mapCheckpoints,
  maps,
  mysteryBoxes,
  mysteryBoxPlays,
  prizeClaims,
  prizes,
  prizeUnlockAttempts,
  puzzlePieceEvents,
  puzzles,
  userCheckpoints,
  userMapProgress,
  userPuzzles,
} from "@/db/schema";
import { allocatePieces, checkpointStates, isValidPercentSplit, type CheckpointState } from "@/lib/adventure";
import { AppError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { fmtCash } from "@/lib/format-money";
import { formatCredits, formatMYR, toMinor } from "@/lib/money";
import { weightedPick } from "@/lib/rng";
import { completedMapLevels, lootCollected, lootCollectedByLevel, mapWon, recordEvent } from "./adventure-core";
import { audit } from "./audit";
import { getConfigWithVersion } from "./config";
import { trackMission } from "./daily";
import { lockPlayer } from "./guards";
import { postTransaction } from "./ledger";
import { boxPrizes, type PrizeList } from "./mystery-box";
import { notify } from "./notifications";
import { createCashReward } from "./rewards";

/* ----------------------------------------------------------------------------
 * Read model
 * ------------------------------------------------------------------------- */

/** "ready" means the previous map is won but this one was never unlocked (players from before maps unlocked automatically). */
export type MapState = "locked" | "ready" | "exploring" | "completed";

export type LootItemView = { id: string; name: string; icon: string; rarity: string; description: string; collected: number };

export type CheckpointView = {
  id: string;
  position: number;
  name: string;
  description: string;
  landmark: string;
  lootRequired: number;
  isFinal: boolean;
  posX: number;
  posY: number;
  state: CheckpointState;
  isNext: boolean;
};

export type BigBoxView = {
  id: string;
  name: string;
  description: string;
  /** Piece counts the Big Box can give. */
  pieces: number[];
  state: "hidden" | "available" | "opened" | "unavailable";
  piecesFound: number | null;
};

export type AdventureMapView = {
  id: string;
  level: number;
  name: string;
  description: string;
  artwork: string | null;
  color: string;
  /** Loot collected in the current round of this map. */
  lootCollected: number;
  lootItems: LootItemView[];
  /** "completed" means the current round is finished. */
  state: MapState;
  /** Finished at least once, which is what unlocks the next map. */
  cleared: boolean;
  round: number;
  /** The current round is finished and its Big Mystery Box opened, so another round can start. */
  canReplay: boolean;
  prerequisiteLevel: number | null;
  /** The name of this level's Mystery Box, e.g. "Lost Shore Box". */
  boxName: string;
  checkpoints: CheckpointView[];
  checkpointsDone: number;
  nextLootTarget: number;
  bigBox: BigBoxView | null;
};

export type AdventureBoxView = {
  id: string;
  level: number;
  name: string;
  description: string;
  priceCredits: number;
  artwork: string | null;
  theme: { color: string; accent: string };
  locked: boolean;
  lockReason: string | null;
  /** Its map is complete. The box stays open, so players can keep opening it. */
  completed: boolean;
  /** The map to visit to unlock this box: its own map when that is ready, otherwise the map before it. */
  unlockMapLevel: number | null;
  timesOpened: number;
  /** Free plays won from Free unlocks, used up before any Credits are charged. */
  freePlays: number;
  /** The player's jackpot meter on this box, or null when the box has no jackpot. */
  jackpot: { plays: number; target: number; spins: number } | null;
  lootLevel: number;
};

export type PrizeView = {
  id: string;
  name: string;
  description: string;
  image: string | null;
  kind: "PHYSICAL" | "CREDITS" | "CASH";
  display: string;
  estimatedValue: string | null;
  available: boolean;
  requiresVerification: boolean;
  claimInstructions: string;
};

export type PuzzleView = {
  id: string;
  level: number;
  name: string;
  description: string;
  image: string | null;
  piecesRequired: number;
  piecesHave: number;
  complete: boolean;
  mapCompleted: boolean;
  prize: PrizeView;
  alternative: { type: "CREDITS" | "CASH"; amount: string; display: string };
  attempt: { id: string; outcome: "PRIZE" | "ALTERNATIVE"; alternativeDisplay: string | null; createdAt: string } | null;
  claim: { id: string; status: (typeof prizeClaims.$inferSelect)["status"] } | null;
  canSpin: boolean;
};

export type NextStep = { kind: "claim" | "wheel" | "bigbox" | "map" | "checkpoint" | "loot" | "done"; title: string; detail: string; href: string };

async function cashLabel(amount: string) {
  return fmtCash(amount);
}

async function prizeView(p: typeof prizes.$inferSelect): Promise<PrizeView> {
  const display = p.kind === "CREDITS" ? `${formatCredits(p.amount)} Credits` : p.kind === "CASH" ? `${await cashLabel(p.amount)} Cash Reward` : p.name;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    image: p.image,
    kind: p.kind,
    display,
    estimatedValue: p.showEstimatedValue && p.estimatedValue ? await cashLabel(p.estimatedValue) : null,
    available: p.active && (p.inventoryTotal === null || p.inventoryAllocated < p.inventoryTotal),
    requiresVerification: p.requiresVerification,
    claimInstructions: p.claimInstructions,
  };
}

async function rewardDisplay(type: "CREDITS" | "CASH", amount: string) {
  return type === "CREDITS" ? `${formatCredits(amount)} Credits` : `${await cashLabel(amount)} Cash Reward`;
}

async function storedRewardDisplay(reward: Record<string, unknown> | null) {
  if (!reward || (reward.type !== "CREDITS" && reward.type !== "CASH") || typeof reward.amount !== "string") return null;
  return rewardDisplay(reward.type, reward.amount);
}

async function publishedMaps(tx: DbOrTx) {
  return tx
    .select()
    .from(maps)
    .where(and(eq(maps.status, "PUBLISHED"), isNotNull(maps.level)))
    .orderBy(asc(maps.level));
}

/** The published adventure map directly before this level (the one that must be completed first). */
async function previousMap(tx: DbOrTx, level: number) {
  const [prev] = await tx
    .select()
    .from(maps)
    .where(and(eq(maps.status, "PUBLISHED"), isNotNull(maps.level), lt(maps.level, level)))
    .orderBy(desc(maps.level))
    .limit(1);
  return prev ?? null;
}

async function totalPieces(tx: DbOrTx, userId: string) {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(sum(${puzzlePieceEvents.delta}), 0)::int` })
    .from(puzzlePieceEvents)
    .where(eq(puzzlePieceEvents.userId, userId));
  return Number(row?.n ?? 0);
}

/** Pieces found per level. A level's Big Mystery Box only adds to that level's puzzle. */
async function piecesByLevel(tx: DbOrTx, userId: string) {
  const rows = await tx
    .select({ level: puzzlePieceEvents.level, n: sql<number>`coalesce(sum(${puzzlePieceEvents.delta}), 0)::int` })
    .from(puzzlePieceEvents)
    .where(eq(puzzlePieceEvents.userId, userId))
    .groupBy(puzzlePieceEvents.level);
  return new Map(rows.filter((r) => r.level !== null).map((r) => [r.level as number, Number(r.n)]));
}

/** Puzzles in sequence: every active puzzle plus any the player already completed (using their recorded size). */
async function puzzleSequence(tx: DbOrTx, userId: string) {
  const [all, done] = await Promise.all([
    tx.select().from(puzzles).orderBy(asc(puzzles.level)),
    tx.select().from(userPuzzles).where(eq(userPuzzles.userId, userId)),
  ]);
  const doneBy = new Map(done.map((d) => [d.puzzleId, d]));
  const seq = all.filter((p) => p.active || doneBy.has(p.id)).map((p) => ({ ...p, piecesRequired: doneBy.get(p.id)?.piecesRequired ?? p.piecesRequired }));
  return { seq, doneBy };
}

export async function getAdventureState(userId: string, tx: DbOrTx = db) {
  const [boxRows, mapRows, lootByLevel, lootItems, wheelCfg, byLevel, { seq, doneBy }] = await Promise.all([
    tx
      .select()
      .from(mysteryBoxes)
      .where(and(eq(mysteryBoxes.status, "PUBLISHED"), isNotNull(mysteryBoxes.level)))
      .orderBy(asc(mysteryBoxes.level)),
    publishedMaps(tx),
    lootCollectedByLevel(tx, userId),
    tx
      .select({ item: items, collected: inventory.totalAcquired })
      .from(items)
      .leftJoin(inventory, and(eq(inventory.itemId, items.id), eq(inventory.userId, userId)))
      .where(and(eq(items.kind, "LOOT"), isNotNull(items.adventureLevel), eq(items.status, "PUBLISHED")))
      .orderBy(asc(items.sortOrder)),
    getConfigWithVersion("prize_wheel", tx),
    piecesByLevel(tx, userId),
    puzzleSequence(tx, userId),
  ]);
  const pieces = [...byLevel.values()].reduce((a, b) => a + b, 0);
  const mapIds = mapRows.map((m) => m.id);
  const boxIds = boxRows.map((b) => b.id);
  const [cps, progress, doneCps, bigBoxes, openings, attempts, claims, prizeRows, openCounts, freeCounts, jackpotRows] = await Promise.all([
    mapIds.length
      ? tx
          .select()
          .from(mapCheckpoints)
          .where(and(inArray(mapCheckpoints.mapId, mapIds), eq(mapCheckpoints.status, "PUBLISHED")))
          .orderBy(asc(mapCheckpoints.position))
      : [],
    tx.select().from(userMapProgress).where(eq(userMapProgress.userId, userId)),
    tx.select({ checkpointId: userCheckpoints.checkpointId, round: userCheckpoints.round }).from(userCheckpoints).where(eq(userCheckpoints.userId, userId)),
    mapIds.length ? tx.select().from(bigMysteryBoxes).where(inArray(bigMysteryBoxes.mapId, mapIds)) : [],
    tx.select().from(bigBoxOpenings).where(eq(bigBoxOpenings.userId, userId)),
    tx.select().from(prizeUnlockAttempts).where(eq(prizeUnlockAttempts.userId, userId)),
    tx.select().from(prizeClaims).where(eq(prizeClaims.userId, userId)),
    tx.select().from(prizes),
    boxIds.length
      ? tx
          .select({ boxId: mysteryBoxPlays.boxId, n: sql<number>`count(*)::int` })
          .from(mysteryBoxPlays)
          .where(and(eq(mysteryBoxPlays.userId, userId), inArray(mysteryBoxPlays.boxId, boxIds), isNull(mysteryBoxPlays.jackpotId)))
          .groupBy(mysteryBoxPlays.boxId)
      : [],
    tx
      .select({ boxId: freeBoxPlays.boxId, n: sql<number>`count(*)::int` })
      .from(freeBoxPlays)
      .where(and(eq(freeBoxPlays.userId, userId), isNull(freeBoxPlays.usedByPlayId)))
      .groupBy(freeBoxPlays.boxId),
    tx
      .select({ boxId: boxJackpots.boxId, at: sql<number>`max(${boxJackpots.playsAt})::int` })
      .from(boxJackpots)
      .where(eq(boxJackpots.userId, userId))
      .groupBy(boxJackpots.boxId),
  ]);

  const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.level));
  const opened = new Map(openCounts.map((r) => [r.boxId, Number(r.n)]));
  const free = new Map(freeCounts.map((r) => [r.boxId, Number(r.n)]));
  const jackpotAt = new Map(jackpotRows.map((r) => [r.boxId, Number(r.at)]));
  /** A map is won once its final checkpoint is reached and its Big Mystery Box opened (if it has an active one). */
  const won = (m: (typeof mapRows)[number]) =>
    completed.has(m.level as number) && (openings.some((o) => o.mapId === m.id) || !bigBoxes.find((b) => b.mapId === m.id)?.active);

  const mapViews: AdventureMapView[] = mapRows.map((m, i) => {
    const level = m.level as number;
    const prog = progress.find((p) => p.mapId === m.id);
    const prev = i > 0 ? mapRows[i - 1] : null;
    const round = prog?.round ?? 1;
    // Loot counts from the start of the current round, so replayed rounds fill the chests again.
    const loot = Math.max(0, (lootByLevel.get(level) ?? 0) - (prog?.roundLootBase ?? 0));
    // The first map is every player's starting point, so it is open without an unlock step.
    const open = Boolean(prog) || !prev;
    const state: MapState = prog?.roundCompletedAt ? "completed" : open ? "exploring" : prev && won(prev) ? "ready" : "locked";
    const mine = cps.filter((c) => c.mapId === m.id);
    const doneSet = new Set(doneCps.filter((c) => c.round === round).map((c) => c.checkpointId));
    const states = checkpointStates(mine, doneSet, loot, open);
    const nextId = mine.filter((c) => !doneSet.has(c.id)).sort((a, b) => Number(a.isFinal) - Number(b.isFinal) || a.position - b.position)[0]?.id;
    const checkpoints = mine.map((c) => ({
      id: c.id,
      position: c.position,
      name: c.name,
      description: c.description,
      landmark: c.landmark,
      lootRequired: c.lootRequired,
      isFinal: c.isFinal,
      posX: c.posX,
      posY: c.posY,
      state: states.get(c.id) ?? "locked",
      isNext: c.id === nextId && open,
    }));
    const next = checkpoints.find((c) => c.isNext);
    const bb = bigBoxes.find((b) => b.mapId === m.id);
    const opening = openings.find((o) => o.mapId === m.id && o.round === round);
    return {
      id: m.id,
      level,
      name: m.name,
      description: m.description,
      artwork: m.artwork,
      color: m.color,
      lootCollected: loot,
      lootItems: lootItems
        .filter((r) => r.item.adventureLevel === level)
        .map((r) => ({ id: r.item.id, name: r.item.name, icon: r.item.icon, rarity: r.item.rarity, description: r.item.purpose, collected: r.collected ?? 0 })),
      state,
      cleared: completed.has(level),
      round,
      canReplay: state === "completed" && (Boolean(opening) || !bb?.active),
      prerequisiteLevel: prev?.level ?? null,
      boxName: boxRows.find((b) => b.level === level)?.name ?? `${m.name} Box`,
      checkpoints,
      checkpointsDone: checkpoints.filter((c) => c.state === "completed").length,
      nextLootTarget: next?.lootRequired ?? 0,
      bigBox: bb
        ? {
            id: bb.id,
            name: bb.name,
            description: bb.description,
            pieces: [bb.pieces1Pct, bb.pieces2Pct, bb.pieces3Pct].flatMap((pct, i) => (pct > 0 ? [i + 1] : [])),
            state: opening ? "opened" : state !== "completed" ? "hidden" : bb.active ? "available" : "unavailable",
            piecesFound: opening?.pieces ?? null,
          }
        : null,
    };
  });

  const boxViews: AdventureBoxView[] = boxRows.map((b) => {
    const own = mapViews.find((m) => m.level === b.level);
    const before = own ? mapViews.filter((m) => m.level < own.level).at(-1) : undefined;
    let locked: boolean;
    let lockReason: string | null = null;
    let unlockMapLevel: number | null = null;
    if (own) {
      locked = own.state === "locked" || own.state === "ready";
      if (own.state === "ready") {
        lockReason = `Unlock Map ${own.level} (${own.name}) to open this box`;
        unlockMapLevel = own.level;
      } else if (locked && before) {
        lockReason = `Win the Big Mystery Box on Map ${before.level} to unlock Map ${own.level} and this box`;
        unlockMapLevel = before.level;
      }
    } else {
      locked = b.requiresMapLevel !== null && !completed.has(b.requiresMapLevel);
      const req = mapViews.find((m) => m.level === b.requiresMapLevel);
      if (locked) {
        lockReason = `Complete Map ${b.requiresMapLevel}${req ? ` (${req.name})` : ""} to unlock this box`;
        unlockMapLevel = b.requiresMapLevel;
      }
    }
    return {
      id: b.id,
      level: b.level as number,
      name: b.name,
      description: b.description,
      priceCredits: b.priceCredits,
      artwork: b.artwork,
      theme: b.theme,
      locked,
      lockReason,
      completed: completed.has(b.level as number),
      unlockMapLevel,
      timesOpened: opened.get(b.id) ?? 0,
      freePlays: free.get(b.id) ?? 0,
      jackpot:
        b.jackpotPlays > 0
          ? { plays: Math.max(0, Math.min(b.jackpotPlays, (opened.get(b.id) ?? 0) - (jackpotAt.get(b.id) ?? 0))), target: b.jackpotPlays, spins: b.jackpotSpins }
          : null,
      lootLevel: b.level as number,
    };
  });

  const wheel = wheelCfg.value;
  const wheelActive = wheel.active && isValidPercentSplit([wheel.prizeUnlockPct, wheel.alternativePct]);
  const allocation = allocatePieces(seq, byLevel);
  const puzzleViews: PuzzleView[] = [];
  for (const a of allocation) {
    const p = seq.find((x) => x.id === a.id)!;
    const prize = prizeRows.find((x) => x.id === (doneBy.get(p.id)?.prizeId ?? p.prizeId))!;
    const attempt = attempts.find((x) => x.puzzleId === p.id);
    const claim = attempt ? claims.find((c) => c.attemptId === attempt.id) : undefined;
    const pv = await prizeView(prize);
    const complete = doneBy.has(p.id);
    puzzleViews.push({
      id: p.id,
      level: p.level,
      name: p.name,
      description: p.description,
      image: p.image,
      piecesRequired: a.piecesRequired,
      piecesHave: complete ? a.piecesRequired : a.piecesHave,
      complete,
      mapCompleted: completed.has(p.level),
      prize: pv,
      alternative: { type: p.alternativeRewardType, amount: p.alternativeRewardAmount, display: await rewardDisplay(p.alternativeRewardType, p.alternativeRewardAmount) },
      attempt: attempt
        ? { id: attempt.id, outcome: attempt.outcome, alternativeDisplay: await storedRewardDisplay(attempt.alternativeReward), createdAt: attempt.createdAt.toISOString() }
        : null,
      claim: claim ? { id: claim.id, status: claim.status } : null,
      canSpin: complete && !attempt && wheelActive && pv.available,
    });
  }

  const currentMap = mapViews.find((m) => !m.cleared) ?? mapViews.at(-1) ?? null;
  const currentLevel = currentMap?.level ?? 1;
  const totalLevels = Math.max(mapViews.length, boxViews.length, 1);
  const unlockedBoxes = boxViews.filter((b) => !b.locked).length;
  const completedMaps = mapViews.filter((m) => m.cleared).length;
  const currentBox = boxViews.findLast((b) => !b.locked) ?? boxViews[0] ?? null;

  return {
    boxes: boxViews,
    maps: mapViews,
    puzzles: puzzleViews,
    totalPieces: pieces,
    wheel: { active: wheelActive },
    currentLevel,
    totalLevels,
    unlockedBoxes,
    completedMaps,
    currentMap,
    currentBox,
    nextStep: nextStepFor(mapViews, puzzleViews, currentMap),
  };
}

export type AdventureState = Awaited<ReturnType<typeof getAdventureState>>;

function nextStepFor(mapViews: AdventureMapView[], puzzleViews: PuzzleView[], current: AdventureMapView | null): NextStep {
  const claim = puzzleViews.find((p) => p.claim?.status === "UNLOCKED");
  if (claim) return { kind: "claim", title: `Claim your Adventure Level ${claim.level} prize`, detail: claim.prize.name, href: "/play/prizes" };
  const spin = puzzleViews.find((p) => p.canSpin);
  if (spin) return { kind: "wheel", title: "Final unlock ready", detail: `Adventure Level ${spin.level} puzzle complete: ${spin.prize.name}`, href: "/play/prizes" };
  const box = mapViews.find((m) => m.bigBox?.state === "available");
  if (box) return { kind: "bigbox", title: "Open your Big Mystery Box", detail: `Found at the end of ${box.name}`, href: `/play/map?level=${box.level}` };
  if (!current) return { kind: "done", title: "Your adventure is being prepared", detail: "Check back soon.", href: "/play" };
  const href = `/play/map?level=${current.level}`;
  switch (current.state) {
    case "locked":
      return { kind: "map", title: `Win Adventure Level ${current.prerequisiteLevel}`, detail: `Open its Big Mystery Box to unlock ${current.name}`, href };
    case "ready":
      return { kind: "map", title: `Unlock Map ${current.level}`, detail: `${current.name} is ready to explore`, href };
    case "exploring": {
      const next = current.checkpoints.find((c) => c.isNext);
      if (!next) return { kind: "checkpoint", title: `Explore ${current.name}`, detail: "Reach the final checkpoint", href };
      if (next.state === "available") return { kind: "checkpoint", title: "Your chest is full", detail: next.isFinal ? `Collect it to reach ${next.name} and unlock puzzles` : `Collect it and move up to ${next.name}`, href };
      return { kind: "loot", title: `Collect ${next.lootRequired - current.lootCollected} more Loot`, detail: `to move up to ${next.name}`, href: `/play/mystery-box?level=${current.level}` };
    }
    case "completed":
      return { kind: "done", title: "Adventure complete", detail: "Every map has been explored.", href: "/play/prizes" };
  }
}

/** What a box can give: the lucky drop prizes and the guaranteed Loot drop, without chances. */
export async function adventureBoxPrizes(boxId: string): Promise<{ rewards: PrizeList; loot: PrizeList }> {
  const [box] = await db.select().from(mysteryBoxes).where(eq(mysteryBoxes.id, boxId)).limit(1);
  if (!box) return { rewards: [], loot: [] };
  return { rewards: await boxPrizes(box.rewardPoolId), loot: box.lootPoolId ? await boxPrizes(box.lootPoolId) : [] };
}

/* ----------------------------------------------------------------------------
 * Map unlock & checkpoints
 * ------------------------------------------------------------------------- */

/**
 * Opens a map for the player and records it. The caller has already checked that the map before
 * it is won. Returns false when the player had already unlocked it.
 */
/** The name of a level's Mystery Box, falling back to the map's name. */
async function levelBoxName(tx: DbOrTx, level: number, mapName: string) {
  const [b] = await tx
    .select({ name: mysteryBoxes.name })
    .from(mysteryBoxes)
    .where(and(eq(mysteryBoxes.level, level), eq(mysteryBoxes.status, "PUBLISHED")))
    .limit(1);
  return b?.name ?? `${mapName} Box`;
}

async function grantMap(tx: Tx, userId: string, map: typeof maps.$inferSelect) {
  const level = map.level as number;
  const loot = await lootCollected(tx, userId, level);
  const [row] = await tx.insert(userMapProgress).values({ userId, mapId: map.id, level, lootAtUnlock: loot }).onConflictDoNothing().returning();
  if (!row) return false;
  await recordEvent(tx, {
    userId,
    type: "MAP_UNLOCK",
    actionId: `map-unlock:${userId}:${map.id}`,
    level,
    refType: "map",
    refId: map.id,
    config: { mapVersion: map.version },
    result: { lootCollected: loot },
  });
  await trackMission(tx, userId, "UNLOCK_AREA");
  await notify(tx, userId, "REWARD", `Map ${level} unlocked`, `${map.name} and the ${await levelBoxName(tx, level, map.name)} are open. Start exploring its checkpoints.`, `/play/map?level=${level}`);
  return true;
}

/** Unlocks the map after `level`, once the player has won `level`. Returns the map it unlocked. */
async function unlockNextMap(tx: Tx, userId: string, level: number) {
  const [next] = await tx
    .select()
    .from(maps)
    .where(and(eq(maps.status, "PUBLISHED"), gt(maps.level, level)))
    .orderBy(asc(maps.level))
    .limit(1);
  if (!next) return null;
  if (!(await grantMap(tx, userId, next))) return null;
  return { level: next.level as number, name: next.name, boxName: await levelBoxName(tx, next.level as number, next.name) };
}

export async function unlockMap(userId: string, mapId: string) {
  return db.transaction(async (tx) => {
    await lockPlayer(tx, userId);
    const [map] = await tx.select().from(maps).where(eq(maps.id, mapId)).limit(1);
    if (!map || map.status !== "PUBLISHED" || map.level === null) throw new NotFoundError("This map is not available");
    const prev = await previousMap(tx, map.level);
    if (prev && !(await mapWon(tx, userId, prev))) {
      throw new AppError(`Win the Big Mystery Box on Map ${prev.level} (${prev.name}) first`, "MAP_LOCKED", 403);
    }
    const granted = await grantMap(tx, userId, map);
    return { mapId: map.id, level: map.level, name: map.name, replayed: !granted };
  });
}

/**
 * Starts another round of a finished map: its checkpoints reset and fill again from new Loot, and
 * reaching the end gives another Big Mystery Box. Loot above the last round's final chest carries over.
 */
export async function replayMap(userId: string, mapId: string) {
  return db.transaction(async (tx) => {
    await lockPlayer(tx, userId);
    const [map] = await tx.select().from(maps).where(eq(maps.id, mapId)).limit(1);
    if (!map || map.status !== "PUBLISHED" || map.level === null) throw new NotFoundError("This map is not available");
    const [prog] = await tx
      .select()
      .from(userMapProgress)
      .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)))
      .limit(1);
    if (!prog?.roundCompletedAt) throw new AppError(`Reach the final checkpoint of ${map.name} first`, "MAP_NOT_FINISHED", 403);
    const [[bb], [opening], [final]] = await Promise.all([
      tx.select().from(bigMysteryBoxes).where(eq(bigMysteryBoxes.mapId, map.id)).limit(1),
      tx
        .select({ id: bigBoxOpenings.id })
        .from(bigBoxOpenings)
        .where(and(eq(bigBoxOpenings.userId, userId), eq(bigBoxOpenings.mapId, map.id), eq(bigBoxOpenings.round, prog.round)))
        .limit(1),
      tx
        .select({ lootRequired: sql<number>`max(${userCheckpoints.lootRequired})::int` })
        .from(userCheckpoints)
        .where(and(eq(userCheckpoints.userId, userId), eq(userCheckpoints.mapId, map.id), eq(userCheckpoints.round, prog.round))),
    ]);
    if (bb?.active && !opening) throw new AppError("Open the Big Mystery Box at the finish first", "BIG_BOX_WAITING", 403);
    const round = prog.round + 1;
    const roundLootBase = prog.roundLootBase + Number(final?.lootRequired ?? 0);
    await tx
      .update(userMapProgress)
      .set({ round, roundLootBase, roundCompletedAt: null })
      .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)));
    await recordEvent(tx, {
      userId,
      type: "MAP_UNLOCK",
      actionId: `map-replay:${userId}:${map.id}:round-${round}`,
      level: map.level,
      refType: "map",
      refId: map.id,
      config: { mapVersion: map.version, replay: true, round },
      result: { roundLootBase },
    });
    return { mapId: map.id, level: map.level, name: map.name, round };
  });
}

export type MapCompletion = {
  level: number;
  name: string;
  /** Which run through the map this was. Maps can be replayed after their Big Mystery Box is opened. */
  round: number;
  firstClear: boolean;
  /** Unlocked straight away only when the map has no active Big Mystery Box; otherwise opening it unlocks the next map. */
  unlockedMap: { level: number; name: string; boxName: string } | null;
};

export type CheckpointResult = {
  checkpointId: string;
  name: string;
  mapId: string;
  level: number;
  isFinal: boolean;
  completion: MapCompletion | null;
  bigBox: { id: string; name: string } | null;
  replayed: boolean;
};

export async function unlockCheckpoint(userId: string, checkpointId: string): Promise<CheckpointResult> {
  try {
    return await db.transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const [cp] = await tx.select().from(mapCheckpoints).where(eq(mapCheckpoints.id, checkpointId)).limit(1);
      if (!cp || cp.status !== "PUBLISHED") throw new NotFoundError("This checkpoint is not available");
      const [map] = await tx.select().from(maps).where(eq(maps.id, cp.mapId)).limit(1);
      if (!map || map.status !== "PUBLISHED" || map.level === null) throw new NotFoundError("This map is not available");
      const level = map.level;

      let [prog] = await tx
        .select()
        .from(userMapProgress)
        .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)))
        .limit(1);
      const round = prog?.round ?? 1;
      const [already] = await tx
        .select({ id: userCheckpoints.id })
        .from(userCheckpoints)
        .where(and(eq(userCheckpoints.userId, userId), eq(userCheckpoints.checkpointId, cp.id), eq(userCheckpoints.round, round)))
        .limit(1);
      if (already) return { checkpointId: cp.id, name: cp.name, mapId: map.id, level, isFinal: cp.isFinal, completion: null, bigBox: null, replayed: true };

      if (!prog) {
        if (await previousMap(tx, level)) throw new AppError(`Unlock ${map.name} first`, "MAP_NOT_UNLOCKED", 403);
        const startLoot = await lootCollected(tx, userId, level);
        [prog] = await tx.insert(userMapProgress).values({ userId, mapId: map.id, level, lootAtUnlock: startLoot }).returning();
        await recordEvent(tx, {
          userId,
          type: "MAP_UNLOCK",
          actionId: `map-unlock:${userId}:${map.id}`,
          level,
          refType: "map",
          refId: map.id,
          config: { lootRequired: 0, mapVersion: map.version, startingMap: true },
          result: { lootCollected: startLoot },
        });
      }

      const all = await tx
        .select()
        .from(mapCheckpoints)
        .where(and(eq(mapCheckpoints.mapId, map.id), eq(mapCheckpoints.status, "PUBLISHED")));
      const done = new Set(
        (
          await tx
            .select({ checkpointId: userCheckpoints.checkpointId })
            .from(userCheckpoints)
            .where(and(eq(userCheckpoints.userId, userId), eq(userCheckpoints.mapId, map.id), eq(userCheckpoints.round, round)))
        ).map((r) => r.checkpointId),
      );
      const loot = (await lootCollected(tx, userId, level)) - prog.roundLootBase;
      const state = checkpointStates(all, done, loot, true).get(cp.id);
      if (state !== "available") {
        const earlier = all
          .filter((c) => !done.has(c.id) && c.id !== cp.id && (cp.isFinal ? !c.isFinal : !c.isFinal && c.position < cp.position))
          .sort((a, b) => a.position - b.position)[0];
        if (earlier) throw new AppError(`Discover ${earlier.name} first`, "CHECKPOINT_LOCKED", 403);
        throw new AppError(`Collect ${cp.lootRequired - loot} more Loot to reach ${cp.name}`, "LOOT_REQUIRED");
      }

      await tx.insert(userCheckpoints).values({ userId, checkpointId: cp.id, mapId: map.id, lootRequired: cp.lootRequired, lootAtUnlock: loot, round });
      const actionId = round === 1 ? `checkpoint:${userId}:${cp.id}` : `checkpoint:${userId}:${cp.id}:round-${round}`;
      await recordEvent(tx, {
        userId,
        type: "MAP_CHECKPOINT_UNLOCK",
        actionId,
        level,
        refType: "map_checkpoint",
        refId: cp.id,
        config: { lootRequired: cp.lootRequired, position: cp.position, isFinal: cp.isFinal, round },
        result: { lootCollected: loot },
      });
      await trackMission(tx, userId, "DISCOVER_TILE");

      let completion: MapCompletion | null = null;
      let bigBox: CheckpointResult["bigBox"] = null;
      if (cp.isFinal) {
        const firstClear = !prog.completedAt;
        const now = new Date();
        const [finished] = await tx
          .update(userMapProgress)
          .set({ roundCompletedAt: now, completedAt: prog.completedAt ?? now })
          .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id), isNull(userMapProgress.roundCompletedAt)))
          .returning();
        if (finished) {
          const [bb] = await tx.select().from(bigMysteryBoxes).where(eq(bigMysteryBoxes.mapId, map.id)).limit(1);
          // With an active Big Mystery Box, opening it is what unlocks the next map.
          const unlockedMap = bb?.active || !firstClear ? null : await unlockNextMap(tx, userId, level);
          completion = { level, name: map.name, round, firstClear, unlockedMap };
          await recordEvent(tx, {
            userId,
            type: "MAP_COMPLETION",
            actionId: firstClear ? `map-complete:${userId}:${map.id}` : `map-complete:${userId}:${map.id}:round-${round}`,
            level,
            refType: "map",
            refId: map.id,
            config: { mapVersion: map.version, round },
            result: completion,
          });
          await notify(
            tx,
            userId,
            "REWARD",
            firstClear ? `Map ${level} complete: ${map.name}` : `Round ${round} of ${map.name} complete`,
            !firstClear
              ? bb?.active
                ? "Open the Big Mystery Box at the finish for more Puzzle Pieces."
                : "Play the map again whenever you like."
              : bb?.active
                ? "Open the Big Mystery Box at the finish to unlock the next map."
                : unlockedMap
                  ? `Map ${unlockedMap.level} and the ${unlockedMap.boxName} are now unlocked.`
                  : "You've completed the final map of the adventure.",
            `/play/map?level=${level}`,
          );
          await syncPuzzleCompletions(tx, userId);
        }
        const [bb] = await tx.select().from(bigMysteryBoxes).where(eq(bigMysteryBoxes.mapId, map.id)).limit(1);
        if (bb?.active) bigBox = { id: bb.id, name: bb.name };
      }
      return { checkpointId: cp.id, name: cp.name, mapId: map.id, level, isFinal: cp.isFinal, completion, bigBox, replayed: false };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const [cp] = await db.select().from(mapCheckpoints).where(eq(mapCheckpoints.id, checkpointId)).limit(1);
      return { checkpointId, name: cp?.name ?? "", mapId: cp?.mapId ?? "", level: 0, isFinal: cp?.isFinal ?? false, completion: null, bigBox: null, replayed: true };
    }
    throw err;
  }
}

/* ----------------------------------------------------------------------------
 * Big Mystery Box & puzzles
 * ------------------------------------------------------------------------- */

export type CompletedPuzzle = { puzzleId: string; level: number; name: string; prizeName: string };

/** Records completion for every puzzle whose pieces are full and whose map level is complete. Idempotent. */
export async function syncPuzzleCompletions(tx: Tx, userId: string): Promise<CompletedPuzzle[]> {
  const [{ seq, doneBy }, byLevel, mapsDone] = await Promise.all([puzzleSequence(tx, userId), piecesByLevel(tx, userId), completedMapLevels(tx, userId)]);
  const out: CompletedPuzzle[] = [];
  for (const a of allocatePieces(seq, byLevel)) {
    const p = seq.find((x) => x.id === a.id)!;
    if (doneBy.has(p.id) || !p.active || !a.piecesFull || !mapsDone.has(p.level)) continue;
    const [row] = await tx
      .insert(userPuzzles)
      .values({ userId, puzzleId: p.id, level: p.level, piecesRequired: p.piecesRequired, piecesTotalAt: a.piecesFound, prizeId: p.prizeId })
      .onConflictDoNothing()
      .returning();
    if (!row) continue;
    const [prize] = await tx.select().from(prizes).where(eq(prizes.id, p.prizeId)).limit(1);
    await recordEvent(tx, {
      userId,
      type: "PUZZLE_COMPLETED",
      actionId: `puzzle:${userId}:${p.id}`,
      level: p.level,
      refType: "puzzle",
      refId: p.id,
      config: { piecesRequired: p.piecesRequired, prizeId: p.prizeId },
      result: { piecesFound: a.piecesFound },
    });
    await notify(tx, userId, "REWARD", `Level ${p.level} puzzle complete`, `One final step remains to unlock ${prize?.name ?? "your prize"}.`, "/play/prizes");
    out.push({ puzzleId: p.id, level: p.level, name: p.name, prizeName: prize?.name ?? "" });
  }
  return out;
}

export type BigBoxResult = {
  openingId: string;
  level: number;
  pieces: number;
  totalPieces: number;
  completedPuzzles: CompletedPuzzle[];
  /** The next map (and its Mystery Box), unlocked by opening this Big Box. */
  unlockedMap: { level: number; name: string; boxName: string } | null;
  /** Where this level's puzzle stands after the pieces were added. */
  puzzle: { name: string; prizeName: string; have: number; required: number } | null;
  replayed: boolean;
};

async function levelPuzzle(tx: DbOrTx, userId: string, level: number): Promise<BigBoxResult["puzzle"]> {
  const [{ seq }, byLevel] = await Promise.all([puzzleSequence(tx, userId), piecesByLevel(tx, userId)]);
  const a = allocatePieces(seq, byLevel).find((x) => x.level === level);
  if (!a) return null;
  const [prize] = await tx.select({ name: prizes.name }).from(prizes).where(eq(prizes.id, a.prizeId)).limit(1);
  return { name: a.name, prizeName: prize?.name ?? "", have: a.piecesHave, required: a.piecesRequired };
}

export async function openBigBox(userId: string, input: { mapId: string; idempotencyKey: string }): Promise<BigBoxResult> {
  const replay = async (): Promise<BigBoxResult | null> => {
    const [prog] = await db
      .select({ round: userMapProgress.round })
      .from(userMapProgress)
      .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, input.mapId)))
      .limit(1);
    const [o] = await db
      .select()
      .from(bigBoxOpenings)
      .where(and(eq(bigBoxOpenings.userId, userId), eq(bigBoxOpenings.mapId, input.mapId), eq(bigBoxOpenings.round, prog?.round ?? 1)))
      .limit(1);
    return o ? { openingId: o.id, level: o.level, pieces: o.pieces, totalPieces: await totalPieces(db, userId), completedPuzzles: [], unlockedMap: null, puzzle: await levelPuzzle(db, userId, o.level), replayed: true } : null;
  };
  const prior = await replay();
  if (prior) return prior;
  try {
    return await db.transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const [map] = await tx.select().from(maps).where(eq(maps.id, input.mapId)).limit(1);
      if (!map || map.level === null) throw new NotFoundError("This map is not available");
      const [prog] = await tx
        .select()
        .from(userMapProgress)
        .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)))
        .limit(1);
      if (!prog?.roundCompletedAt) throw new AppError(`Reach the final checkpoint of ${map.name} first`, "BIG_BOX_LOCKED", 403);
      const [bb] = await tx.select().from(bigMysteryBoxes).where(eq(bigMysteryBoxes.mapId, map.id)).limit(1);
      const split = bb ? [bb.pieces1Pct, bb.pieces2Pct, bb.pieces3Pct] : [];
      if (!bb || !bb.active || !isValidPercentSplit(split)) {
        throw new AppError("The Big Mystery Box is temporarily unavailable. It will be waiting for you.", "BIG_BOX_UNAVAILABLE", 503);
      }
      const pick = weightedPick(split.map((weight, i) => ({ pieces: i + 1, weight })));
      if (!pick) throw new AppError("The Big Mystery Box is temporarily unavailable.", "BIG_BOX_UNAVAILABLE", 503);
      const openingId = randomUUID();
      const odds = { pieces1Pct: bb.pieces1Pct, pieces2Pct: bb.pieces2Pct, pieces3Pct: bb.pieces3Pct, version: bb.version, updatedAt: bb.updatedAt.toISOString() };
      await tx.insert(bigBoxOpenings).values({ id: openingId, userId, mapId: map.id, bigBoxId: bb.id, level: map.level, pieces: pick.pieces, odds, idempotencyKey: input.idempotencyKey, round: prog.round });
      await tx.insert(puzzlePieceEvents).values({ userId, delta: pick.pieces, sourceType: "big_box_opening", sourceId: openingId, level: map.level });
      const base = { userId, level: map.level, refType: "big_box_opening", refId: openingId, config: odds };
      await recordEvent(tx, { ...base, type: "BIG_MYSTERY_BOX_OPEN", actionId: openingId, result: { pieces: pick.pieces, round: prog.round } });
      await recordEvent(tx, { ...base, type: "PUZZLE_PIECE_REWARD", actionId: openingId, result: { pieces: pick.pieces } });
      const completedPuzzles = await syncPuzzleCompletions(tx, userId);
      const unlockedMap = await unlockNextMap(tx, userId, map.level);
      return { openingId, level: map.level, pieces: pick.pieces, totalPieces: await totalPieces(tx, userId), completedPuzzles, unlockedMap, puzzle: await levelPuzzle(tx, userId, map.level), replayed: false };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const r = await replay();
      if (r) return r;
    }
    throw err;
  }
}

/* ----------------------------------------------------------------------------
 * Final Prize Unlock wheel & claims
 * ------------------------------------------------------------------------- */

export type WheelResult = {
  attemptId: string;
  level: number;
  outcome: "PRIZE" | "ALTERNATIVE";
  prizeName: string;
  claimId: string | null;
  alternativeDisplay: string | null;
  replayed: boolean;
};

async function attemptResult(tx: DbOrTx, attempt: typeof prizeUnlockAttempts.$inferSelect, replayed: boolean): Promise<WheelResult> {
  const [prize] = await tx.select({ name: prizes.name }).from(prizes).where(eq(prizes.id, attempt.prizeId)).limit(1);
  const [claim] = await tx.select({ id: prizeClaims.id }).from(prizeClaims).where(eq(prizeClaims.attemptId, attempt.id)).limit(1);
  return {
    attemptId: attempt.id,
    level: attempt.level,
    outcome: attempt.outcome,
    prizeName: prize?.name ?? "",
    claimId: claim?.id ?? null,
    alternativeDisplay: await storedRewardDisplay(attempt.alternativeReward),
    replayed,
  };
}

/**
 * The final unlock stage. One attempt per completed puzzle, ever. Availability is checked
 * under a row lock before the outcome is drawn, so a failed attempt can never be re-rolled.
 */
export async function spinPrizeWheel(userId: string, input: { puzzleId: string; idempotencyKey: string }, rand: (max: number) => number = randomInt): Promise<WheelResult> {
  const find = (tx: DbOrTx) =>
    tx
      .select()
      .from(prizeUnlockAttempts)
      .where(and(eq(prizeUnlockAttempts.userId, userId), eq(prizeUnlockAttempts.puzzleId, input.puzzleId)))
      .limit(1);
  const [prior] = await find(db);
  if (prior) return attemptResult(db, prior, true);
  try {
    return await db.transaction(async (tx) => {
      const profile = await lockPlayer(tx, userId);
      const [again] = await find(tx);
      if (again) return attemptResult(tx, again, true);
      const [puzzle] = await tx.select().from(puzzles).where(eq(puzzles.id, input.puzzleId)).limit(1);
      if (!puzzle) throw new NotFoundError("This puzzle is not available");
      const [done] = await tx
        .select()
        .from(userPuzzles)
        .where(and(eq(userPuzzles.userId, userId), eq(userPuzzles.puzzleId, puzzle.id)))
        .limit(1);
      if (!done) throw new AppError("Complete this puzzle first", "PUZZLE_INCOMPLETE", 403);

      const { value: wheel, updatedAt } = await getConfigWithVersion("prize_wheel", tx);
      if (!wheel.active || !isValidPercentSplit([wheel.prizeUnlockPct, wheel.alternativePct])) {
        throw new AppError("The final unlock is temporarily unavailable. Your puzzle stays complete.", "WHEEL_UNAVAILABLE", 503);
      }
      const [prize] = await tx.select().from(prizes).where(eq(prizes.id, done.prizeId)).for("update");
      if (!prize || !prize.active || (prize.inventoryTotal !== null && prize.inventoryAllocated >= prize.inventoryTotal)) {
        throw new AppError("This prize is temporarily unavailable. Your puzzle stays complete, so you can try again later.", "PRIZE_UNAVAILABLE");
      }
      if (prize.requiresVerification && profile.verificationStatus !== "VERIFIED") {
        throw new AppError("Please verify your account before the final unlock. Go to Account > Verification.", "VERIFICATION_REQUIRED", 403);
      }

      const roll = rand(100);
      const outcome = roll < wheel.prizeUnlockPct ? "PRIZE" : "ALTERNATIVE";
      const attemptId = randomUUID();
      const odds = { prizeUnlockPct: wheel.prizeUnlockPct, alternativePct: wheel.alternativePct, configUpdatedAt: updatedAt };

      let alternativeReward: Record<string, unknown> | null = null;
      let ledgerTransactionId: string | null = null;
      if (outcome === "ALTERNATIVE") {
        const type = puzzle.alternativeRewardType;
        const amount = puzzle.alternativeRewardAmount;
        const display = type === "CREDITS" ? `${formatCredits(amount)} Credits` : `${formatMYR(amount)} Cash Reward`;
        const key = `prize-alt:${attemptId}`;
        if (type === "CREDITS" && toMinor(amount, "CREDITS") > 0n) {
          const n = toMinor(amount, "CREDITS");
          const posted = await postTransaction(tx, {
            type: "GAME_REWARD_CREDITS",
            userId,
            idempotencyKey: `${key}:credits`,
            description: `Level ${puzzle.level} final unlock: alternative reward`,
            sourceType: "prize_unlock_attempt",
            sourceId: attemptId,
            rewardSource: "GAME_REWARD",
            entries: [
              { account: "SYS_REWARD_EXPENSE", currency: "CREDITS", amount: -n },
              { userId, account: "CREDITS", amount: n },
            ],
          });
          ledgerTransactionId = posted.transactionId;
        } else if (type === "CASH" && toMinor(amount, "MYR") > 0n) {
          const row = await createCashReward(tx, {
            userId,
            amount,
            source: "GAME_REWARD",
            sourceType: "prize_unlock_attempt",
            sourceId: attemptId,
            key,
            description: `Level ${puzzle.level} final unlock: alternative reward`,
          });
          ledgerTransactionId = row?.creditTransactionId ?? null;
        }
        alternativeReward = { type, amount, display };
      }

      await tx.insert(prizeUnlockAttempts).values({
        id: attemptId,
        userId,
        puzzleId: puzzle.id,
        userPuzzleId: done.id,
        prizeId: prize.id,
        level: puzzle.level,
        idempotencyKey: input.idempotencyKey,
        outcome,
        roll,
        odds,
        alternativeReward,
        ledgerTransactionId,
      });
      const base = { userId, level: puzzle.level, refType: "prize_unlock_attempt", refId: attemptId, config: odds };
      await recordEvent(tx, { ...base, type: "PRIZE_UNLOCK_ATTEMPT", actionId: attemptId, result: { prizeId: prize.id } });
      await recordEvent(tx, { ...base, type: "PRIZE_UNLOCK_RESULT", actionId: attemptId, result: { outcome, roll } });

      if (outcome === "PRIZE") {
        await tx
          .update(prizes)
          .set({ inventoryAllocated: sql`${prizes.inventoryAllocated} + 1`, updatedAt: new Date() })
          .where(eq(prizes.id, prize.id));
        await tx.insert(prizeClaims).values({
          userId,
          prizeId: prize.id,
          attemptId,
          level: puzzle.level,
          prizeSnapshot: { name: prize.name, kind: prize.kind, amount: prize.amount, image: prize.image, description: prize.description, estimatedValue: prize.estimatedValue },
        });
        await notify(tx, userId, "REWARD", "Prize unlocked", `${prize.name} is unlocked. Claim it from the Prizes page.`, "/play/prizes");
      } else {
        await recordEvent(tx, { ...base, type: "ALTERNATIVE_REWARD", actionId: attemptId, result: alternativeReward ?? {}, ledgerTransactionId });
        await notify(tx, userId, "REWARD", "Alternative reward received", `${(await storedRewardDisplay(alternativeReward)) ?? "Your reward"} from the Level ${puzzle.level} final unlock.`, "/play/prizes");
      }
      const [row] = await find(tx);
      return attemptResult(tx, row, false);
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const [r] = await find(db);
      if (r) return attemptResult(db, r, true);
    }
    throw err;
  }
}

export type ClaimContact = { fullName?: string; phone?: string; address?: string; note?: string };

/** Moves an unlocked prize into the claim process. Credits and Cash prizes are paid through the ledger immediately. */
export async function claimPrize(userId: string, input: { claimId: string; contact: ClaimContact }) {
  return db.transaction(async (tx) => {
    await lockPlayer(tx, userId);
    const [claim] = await tx
      .select()
      .from(prizeClaims)
      .where(and(eq(prizeClaims.id, input.claimId), eq(prizeClaims.userId, userId)))
      .for("update");
    if (!claim) throw new NotFoundError("Prize not found");
    if (claim.status !== "UNLOCKED") return { claimId: claim.id, status: claim.status, replayed: true };
    const snap = claim.prizeSnapshot as { name: string; kind: "PHYSICAL" | "CREDITS" | "CASH"; amount: string };
    const now = new Date();
    let ledgerTransactionId: string | null = null;
    let status = "CLAIM_PENDING" as (typeof prizeClaims.$inferSelect)["status"];
    if (snap.kind === "CREDITS") {
      const n = toMinor(snap.amount, "CREDITS");
      if (n > 0n) {
        const posted = await postTransaction(tx, {
          type: "GAME_REWARD_CREDITS",
          userId,
          idempotencyKey: `prize-claim:${claim.id}:credits`,
          description: `Level ${claim.level} prize: ${snap.name}`,
          sourceType: "prize_claim",
          sourceId: claim.id,
          rewardSource: "GAME_REWARD",
          entries: [
            { account: "SYS_REWARD_EXPENSE", currency: "CREDITS", amount: -n },
            { userId, account: "CREDITS", amount: n },
          ],
        });
        ledgerTransactionId = posted.transactionId;
      }
      status = "FULFILLED";
    } else if (snap.kind === "CASH") {
      const row = await createCashReward(tx, {
        userId,
        amount: snap.amount,
        source: "GAME_REWARD",
        sourceType: "prize_claim",
        sourceId: claim.id,
        key: `prize-claim:${claim.id}`,
        description: `Level ${claim.level} prize: ${snap.name}`,
      });
      ledgerTransactionId = row?.creditTransactionId ?? null;
      status = "FULFILLED";
    } else if (!input.contact.fullName || !input.contact.phone || !input.contact.address) {
      throw new AppError("Please enter your full name, phone number and delivery address");
    }
    const [updated] = await tx
      .update(prizeClaims)
      .set({
        status,
        contact: snap.kind === "PHYSICAL" ? input.contact : {},
        claimedAt: now,
        fulfilledAt: status === "FULFILLED" ? now : null,
        ledgerTransactionId,
        updatedAt: now,
      })
      .where(and(eq(prizeClaims.id, claim.id), eq(prizeClaims.status, "UNLOCKED")))
      .returning();
    if (!updated) return { claimId: claim.id, status: claim.status, replayed: true };
    await recordEvent(tx, {
      userId,
      type: "PRIZE_CLAIM",
      actionId: `claim:${claim.id}`,
      level: claim.level,
      refType: "prize_claim",
      refId: claim.id,
      config: { prize: snap },
      result: { status },
      ledgerTransactionId,
    });
    return { claimId: claim.id, status, replayed: false };
  });
}

export const CLAIM_TRANSITIONS: Partial<Record<(typeof prizeClaims.$inferSelect)["status"], (typeof prizeClaims.$inferSelect)["status"][]>> = {
  CLAIM_PENDING: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["FULFILLING", "FULFILLED", "REJECTED"],
  FULFILLING: ["FULFILLED"],
};

/** Admin review of a physical prize claim. Rejection releases the reserved inventory. */
export async function updatePrizeClaimStatus(
  actor: { id: string; role: string },
  input: { claimId: string; status: (typeof prizeClaims.$inferSelect)["status"]; note: string },
) {
  return db.transaction(async (tx) => {
    const [claim] = await tx.select().from(prizeClaims).where(eq(prizeClaims.id, input.claimId)).for("update");
    if (!claim) throw new NotFoundError("Claim not found");
    if (!(CLAIM_TRANSITIONS[claim.status] ?? []).includes(input.status)) {
      throw new AppError(`A ${claim.status.replace("_", " ").toLowerCase()} claim cannot move to ${input.status.replace("_", " ").toLowerCase()}`);
    }
    const now = new Date();
    await tx
      .update(prizeClaims)
      .set({ status: input.status, reviewerId: actor.id, reviewNote: input.note || claim.reviewNote, fulfilledAt: input.status === "FULFILLED" ? now : claim.fulfilledAt, updatedAt: now })
      .where(eq(prizeClaims.id, claim.id));
    if (input.status === "REJECTED") {
      await tx
        .update(prizes)
        .set({ inventoryAllocated: sql`${prizes.inventoryAllocated} - 1`, updatedAt: now })
        .where(and(eq(prizes.id, claim.prizeId), gt(prizes.inventoryAllocated, 0)));
    }
    await audit(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "prize_claim.status",
      entityType: "prize_claim",
      entityId: claim.id,
      before: { status: claim.status },
      after: { status: input.status },
      reason: input.note || null,
    });
    await recordEvent(tx, {
      userId: claim.userId,
      type: "PRIZE_CLAIM_STATUS",
      actionId: `claim-status:${claim.id}:${input.status}`,
      level: claim.level,
      refType: "prize_claim",
      refId: claim.id,
      result: { from: claim.status, to: input.status, by: actor.id },
    });
    const label = input.status.replace("_", " ").toLowerCase();
    await notify(tx, claim.userId, "REWARD", "Prize claim update", `Your ${String((claim.prizeSnapshot as { name?: string }).name ?? "prize")} claim is now ${label}.`, "/play/prizes");
    return { claimId: claim.id, status: input.status };
  });
}

/** Configuration problems an admin should fix before players reach them. */
export async function adventureConfigWarnings(tx: DbOrTx = db): Promise<string[]> {
  const out: string[] = [];
  const [mapRows, boxRows, cps, bbs, pz] = await Promise.all([
    publishedMaps(tx),
    tx.select().from(mysteryBoxes).where(and(eq(mysteryBoxes.status, "PUBLISHED"), isNotNull(mysteryBoxes.level))),
    tx.select().from(mapCheckpoints).where(eq(mapCheckpoints.status, "PUBLISHED")),
    tx.select().from(bigMysteryBoxes),
    tx.select().from(puzzles).where(eq(puzzles.active, true)),
  ]);
  for (const m of mapRows) {
    const mine = cps.filter((c) => c.mapId === m.id);
    if (!mine.some((c) => c.isFinal)) out.push(`Map ${m.level} (${m.name}) has no final checkpoint, so it can never be completed.`);
    const ordered = [...mine].sort((a, b) => Number(a.isFinal) - Number(b.isFinal) || a.position - b.position);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].lootRequired < ordered[i - 1].lootRequired) out.push(`Map ${m.level}: "${ordered[i].name}" needs less Loot than the checkpoint before it.`);
    }
    if (!boxRows.some((b) => b.level === m.level)) out.push(`Map ${m.level} has no published Mystery Box at the same level, so its Loot cannot be found.`);
    if (!bbs.some((b) => b.mapId === m.id && b.active)) out.push(`Map ${m.level} has no active Big Mystery Box.`);
    if (!pz.some((p) => p.level === m.level)) out.push(`Map ${m.level} has no active puzzle.`);
  }
  for (const b of boxRows) {
    if (!b.lootPoolId) out.push(`Mystery Box level ${b.level} has no Loot pool, so it never grants Loot.`);
  }
  for (const b of bbs) {
    if (!isValidPercentSplit([b.pieces1Pct, b.pieces2Pct, b.pieces3Pct])) out.push(`Big Mystery Box "${b.name}" odds do not total 100%.`);
  }
  const loot = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.kind, "LOOT"), or(isNull(items.adventureLevel), eq(items.status, "DRAFT"))));
  if (loot.length) out.push(`${loot.length} Loot item(s) have no map level or are still drafts.`);
  return out;
}
