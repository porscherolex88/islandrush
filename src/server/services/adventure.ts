import { randomInt, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, type DbOrTx, type Tx } from "@/db";
import {
  bigBoxOpenings,
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
import { completedMapLevels, lootCollected, lootCollectedByLevel, recordEvent } from "./adventure-core";
import { audit } from "./audit";
import { getConfigWithVersion } from "./config";
import { trackMission } from "./daily";
import { lockPlayer } from "./guards";
import { postTransaction } from "./ledger";
import { boxOdds, type PoolOdds } from "./mystery-box";
import { notify } from "./notifications";
import { createCashReward } from "./rewards";
import { awardXp } from "./xp";

/* ----------------------------------------------------------------------------
 * Read model
 * ------------------------------------------------------------------------- */

export type MapState = "locked" | "collecting" | "ready" | "exploring" | "completed";

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
  odds: { pieces: number; pct: number }[];
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
  lootRequired: number;
  lootCollected: number;
  lootItems: LootItemView[];
  state: MapState;
  prerequisiteLevel: number | null;
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
  /** Its map is complete, so the box is retired and can no longer be opened. */
  completed: boolean;
  requiresMapLevel: number | null;
  timesOpened: number;
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
  const [boxRows, mapRows, lootByLevel, lootItems, wheelCfg, pieces, { seq, doneBy }] = await Promise.all([
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
    totalPieces(tx, userId),
    puzzleSequence(tx, userId),
  ]);
  const mapIds = mapRows.map((m) => m.id);
  const boxIds = boxRows.map((b) => b.id);
  const [cps, progress, doneCps, bigBoxes, openings, attempts, claims, prizeRows, openCounts] = await Promise.all([
    mapIds.length
      ? tx
          .select()
          .from(mapCheckpoints)
          .where(and(inArray(mapCheckpoints.mapId, mapIds), eq(mapCheckpoints.status, "PUBLISHED")))
          .orderBy(asc(mapCheckpoints.position))
      : [],
    tx.select().from(userMapProgress).where(eq(userMapProgress.userId, userId)),
    tx.select({ checkpointId: userCheckpoints.checkpointId }).from(userCheckpoints).where(eq(userCheckpoints.userId, userId)),
    mapIds.length ? tx.select().from(bigMysteryBoxes).where(inArray(bigMysteryBoxes.mapId, mapIds)) : [],
    tx.select().from(bigBoxOpenings).where(eq(bigBoxOpenings.userId, userId)),
    tx.select().from(prizeUnlockAttempts).where(eq(prizeUnlockAttempts.userId, userId)),
    tx.select().from(prizeClaims).where(eq(prizeClaims.userId, userId)),
    tx.select().from(prizes),
    boxIds.length
      ? tx
          .select({ boxId: mysteryBoxPlays.boxId, n: sql<number>`count(*)::int` })
          .from(mysteryBoxPlays)
          .where(and(eq(mysteryBoxPlays.userId, userId), inArray(mysteryBoxPlays.boxId, boxIds)))
          .groupBy(mysteryBoxPlays.boxId)
      : [],
  ]);

  const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.level));
  const doneSet = new Set(doneCps.map((c) => c.checkpointId));
  const opened = new Map(openCounts.map((r) => [r.boxId, Number(r.n)]));

  const mapViews: AdventureMapView[] = mapRows.map((m, i) => {
    const level = m.level as number;
    const prog = progress.find((p) => p.mapId === m.id);
    const prev = i > 0 ? mapRows[i - 1] : null;
    const prevDone = !prev || completed.has(prev.level as number);
    const loot = lootByLevel.get(level) ?? 0;
    const state: MapState = prog?.completedAt ? "completed" : prog ? "exploring" : !prevDone ? "locked" : loot >= m.lootRequired ? "ready" : "collecting";
    const mine = cps.filter((c) => c.mapId === m.id);
    const states = checkpointStates(mine, doneSet, loot, Boolean(prog));
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
      isNext: c.id === nextId && Boolean(prog),
    }));
    const next = checkpoints.find((c) => c.isNext);
    const bb = bigBoxes.find((b) => b.mapId === m.id);
    const opening = openings.find((o) => o.mapId === m.id);
    return {
      id: m.id,
      level,
      name: m.name,
      description: m.description,
      artwork: m.artwork,
      color: m.color,
      lootRequired: m.lootRequired,
      lootCollected: loot,
      lootItems: lootItems
        .filter((r) => r.item.adventureLevel === level)
        .map((r) => ({ id: r.item.id, name: r.item.name, icon: r.item.icon, rarity: r.item.rarity, description: r.item.purpose, collected: r.collected ?? 0 })),
      state,
      prerequisiteLevel: prev?.level ?? null,
      checkpoints,
      checkpointsDone: checkpoints.filter((c) => c.state === "completed").length,
      nextLootTarget: state === "exploring" && next ? next.lootRequired : m.lootRequired,
      bigBox: bb
        ? {
            id: bb.id,
            name: bb.name,
            description: bb.description,
            odds: [
              { pieces: 1, pct: bb.pieces1Pct },
              { pieces: 2, pct: bb.pieces2Pct },
              { pieces: 3, pct: bb.pieces3Pct },
            ],
            state: opening ? "opened" : state !== "completed" ? "hidden" : bb.active ? "available" : "unavailable",
            piecesFound: opening?.pieces ?? null,
          }
        : null,
    };
  });

  const boxViews: AdventureBoxView[] = boxRows.map((b) => {
    const locked = b.requiresMapLevel !== null && !completed.has(b.requiresMapLevel);
    const req = mapViews.find((m) => m.level === b.requiresMapLevel);
    return {
      id: b.id,
      level: b.level as number,
      name: b.name,
      description: b.description,
      priceCredits: b.priceCredits,
      artwork: b.artwork,
      theme: b.theme,
      locked,
      lockReason: locked ? `Complete Map ${b.requiresMapLevel}${req ? ` (${req.name})` : ""} to unlock this box` : null,
      completed: completed.has(b.level as number),
      requiresMapLevel: b.requiresMapLevel,
      timesOpened: opened.get(b.id) ?? 0,
      lootLevel: b.level as number,
    };
  });

  const wheel = wheelCfg.value;
  const wheelActive = wheel.active && isValidPercentSplit([wheel.prizeUnlockPct, wheel.alternativePct]);
  const allocation = allocatePieces(seq, pieces);
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

  const currentMap = mapViews.find((m) => m.state !== "completed") ?? mapViews.at(-1) ?? null;
  const currentLevel = currentMap?.level ?? 1;
  const totalLevels = Math.max(mapViews.length, boxViews.length, 1);
  const unlockedBoxes = boxViews.filter((b) => !b.locked).length;
  const completedMaps = mapViews.filter((m) => m.state === "completed").length;
  const currentBox = boxViews.find((b) => !b.locked && !b.completed) ?? boxViews.at(-1) ?? null;

  return {
    boxes: boxViews,
    maps: mapViews,
    puzzles: puzzleViews,
    totalPieces: pieces,
    wheel: { active: wheelActive, prizeUnlockPct: wheel.prizeUnlockPct, alternativePct: wheel.alternativePct },
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
  if (claim) return { kind: "claim", title: `Claim your Level ${claim.level} prize`, detail: claim.prize.name, href: "/app/play/prizes" };
  const spin = puzzleViews.find((p) => p.canSpin);
  if (spin) return { kind: "wheel", title: "Final unlock ready", detail: `Level ${spin.level} puzzle complete: ${spin.prize.name}`, href: "/app/play/prizes" };
  const box = mapViews.find((m) => m.bigBox?.state === "available");
  if (box) return { kind: "bigbox", title: "Open your Big Mystery Box", detail: `Found at the end of ${box.name}`, href: `/app/play/map?level=${box.level}` };
  if (!current) return { kind: "done", title: "Your adventure is being prepared", detail: "Check back soon.", href: "/app/play" };
  const href = `/app/play/map?level=${current.level}`;
  switch (current.state) {
    case "locked":
      return { kind: "map", title: `Complete Map ${current.prerequisiteLevel}`, detail: `to open Map ${current.level}: ${current.name}`, href };
    case "collecting": {
      const need = current.lootRequired - current.lootCollected;
      return { kind: "loot", title: `Collect ${need} more Loot`, detail: `to unlock Map ${current.level}: ${current.name}`, href: `/app/play/mystery-box?level=${current.level}` };
    }
    case "ready":
      return { kind: "map", title: `Unlock Map ${current.level}`, detail: `${current.name} is ready to explore`, href };
    case "exploring": {
      const next = current.checkpoints.find((c) => c.isNext);
      if (!next) return { kind: "checkpoint", title: `Explore ${current.name}`, detail: "Find the final checkpoint", href };
      if (next.state === "available") return { kind: "checkpoint", title: `Explore ${next.name}`, detail: next.isFinal ? "The final checkpoint is ready" : "A checkpoint is ready to discover", href };
      return { kind: "loot", title: `Collect ${next.lootRequired - current.lootCollected} more Loot`, detail: `to reach ${next.name}`, href: `/app/play/mystery-box?level=${current.level}` };
    }
    case "completed":
      return { kind: "done", title: "Adventure complete", detail: "Every map has been explored.", href: "/app/play/prizes" };
  }
}

/** Box odds for both the reward pool and the guaranteed Loot drop, for "View prizes & odds". */
export async function adventureBoxOdds(boxId: string): Promise<{ rewards: PoolOdds; loot: PoolOdds }> {
  const [box] = await db.select().from(mysteryBoxes).where(eq(mysteryBoxes.id, boxId)).limit(1);
  if (!box) return { rewards: [], loot: [] };
  return { rewards: await boxOdds(box.rewardPoolId), loot: box.lootPoolId ? await boxOdds(box.lootPoolId) : [] };
}

/* ----------------------------------------------------------------------------
 * Map unlock & checkpoints
 * ------------------------------------------------------------------------- */

export async function unlockMap(userId: string, mapId: string) {
  try {
    return await db.transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const [map] = await tx.select().from(maps).where(eq(maps.id, mapId)).limit(1);
      if (!map || map.status !== "PUBLISHED" || map.level === null) throw new NotFoundError("This map is not available");
      const [existing] = await tx
        .select()
        .from(userMapProgress)
        .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)))
        .limit(1);
      if (existing) return { mapId: map.id, level: map.level, name: map.name, replayed: true };

      const prev = await previousMap(tx, map.level);
      if (prev && !(await completedMapLevels(tx, userId)).has(prev.level as number)) {
        throw new AppError(`Complete Map ${prev.level} (${prev.name}) first`, "MAP_LOCKED", 403);
      }
      const loot = await lootCollected(tx, userId, map.level);
      if (loot < map.lootRequired) {
        throw new AppError(`Collect ${map.lootRequired - loot} more Loot to unlock ${map.name}`, "LOOT_REQUIRED");
      }
      await tx.insert(userMapProgress).values({ userId, mapId: map.id, level: map.level, lootAtUnlock: loot });
      const actionId = `map-unlock:${userId}:${map.id}`;
      await recordEvent(tx, {
        userId,
        type: "MAP_UNLOCK",
        actionId,
        level: map.level,
        refType: "map",
        refId: map.id,
        config: { lootRequired: map.lootRequired, mapVersion: map.version },
        result: { lootCollected: loot },
      });
      await awardXp(tx, userId, "MAP_UNLOCK", { key: `xp:${actionId}`, sourceId: map.id });
      await trackMission(tx, userId, "UNLOCK_AREA");
      await notify(tx, userId, "REWARD", `Map ${map.level} unlocked`, `${map.name} is open. Start exploring its checkpoints.`, `/app/play/map?level=${map.level}`);
      return { mapId: map.id, level: map.level, name: map.name, replayed: false };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const [map] = await db.select().from(maps).where(eq(maps.id, mapId)).limit(1);
      return { mapId, level: map?.level ?? 0, name: map?.name ?? "", replayed: true };
    }
    throw err;
  }
}

export type MapCompletion = {
  level: number;
  name: string;
  unlockedBoxes: { level: number; name: string }[];
  unlockedMap: { level: number; name: string } | null;
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

      const [already] = await tx
        .select({ id: userCheckpoints.id })
        .from(userCheckpoints)
        .where(and(eq(userCheckpoints.userId, userId), eq(userCheckpoints.checkpointId, cp.id)))
        .limit(1);
      if (already) return { checkpointId: cp.id, name: cp.name, mapId: map.id, level, isFinal: cp.isFinal, completion: null, bigBox: null, replayed: true };

      const [prog] = await tx
        .select()
        .from(userMapProgress)
        .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id)))
        .limit(1);
      if (!prog) throw new AppError(`Unlock ${map.name} first`, "MAP_NOT_UNLOCKED", 403);

      const all = await tx
        .select()
        .from(mapCheckpoints)
        .where(and(eq(mapCheckpoints.mapId, map.id), eq(mapCheckpoints.status, "PUBLISHED")));
      const done = new Set(
        (
          await tx
            .select({ checkpointId: userCheckpoints.checkpointId })
            .from(userCheckpoints)
            .where(and(eq(userCheckpoints.userId, userId), eq(userCheckpoints.mapId, map.id)))
        ).map((r) => r.checkpointId),
      );
      const loot = await lootCollected(tx, userId, level);
      const state = checkpointStates(all, done, loot, true).get(cp.id);
      if (state !== "available") {
        const earlier = all
          .filter((c) => !done.has(c.id) && c.id !== cp.id && (cp.isFinal ? !c.isFinal : !c.isFinal && c.position < cp.position))
          .sort((a, b) => a.position - b.position)[0];
        if (earlier) throw new AppError(`Discover ${earlier.name} first`, "CHECKPOINT_LOCKED", 403);
        throw new AppError(`Collect ${cp.lootRequired - loot} more Loot to reach ${cp.name}`, "LOOT_REQUIRED");
      }

      await tx.insert(userCheckpoints).values({ userId, checkpointId: cp.id, mapId: map.id, lootRequired: cp.lootRequired, lootAtUnlock: loot });
      const actionId = `checkpoint:${userId}:${cp.id}`;
      await recordEvent(tx, {
        userId,
        type: "MAP_CHECKPOINT_UNLOCK",
        actionId,
        level,
        refType: "map_checkpoint",
        refId: cp.id,
        config: { lootRequired: cp.lootRequired, position: cp.position, isFinal: cp.isFinal },
        result: { lootCollected: loot },
      });
      await awardXp(tx, userId, "CHECKPOINT_UNLOCK", { key: `xp:${actionId}`, sourceId: cp.id });
      await trackMission(tx, userId, "DISCOVER_TILE");

      let completion: MapCompletion | null = null;
      let bigBox: CheckpointResult["bigBox"] = null;
      if (cp.isFinal) {
        const [finished] = await tx
          .update(userMapProgress)
          .set({ completedAt: new Date() })
          .where(and(eq(userMapProgress.userId, userId), eq(userMapProgress.mapId, map.id), isNull(userMapProgress.completedAt)))
          .returning();
        if (finished) {
          const unlockedBoxes = await tx
            .select({ level: mysteryBoxes.level, name: mysteryBoxes.name })
            .from(mysteryBoxes)
            .where(and(eq(mysteryBoxes.requiresMapLevel, level), eq(mysteryBoxes.status, "PUBLISHED"), isNotNull(mysteryBoxes.level)))
            .orderBy(asc(mysteryBoxes.level));
          const [nextMap] = await tx
            .select({ level: maps.level, name: maps.name })
            .from(maps)
            .where(and(eq(maps.status, "PUBLISHED"), gt(maps.level, level)))
            .orderBy(asc(maps.level))
            .limit(1);
          completion = {
            level,
            name: map.name,
            unlockedBoxes: unlockedBoxes.map((b) => ({ level: b.level as number, name: b.name })),
            unlockedMap: nextMap ? { level: nextMap.level as number, name: nextMap.name } : null,
          };
          await recordEvent(tx, {
            userId,
            type: "MAP_COMPLETION",
            actionId: `map-complete:${userId}:${map.id}`,
            level,
            refType: "map",
            refId: map.id,
            config: { mapVersion: map.version },
            result: completion,
          });
          await awardXp(tx, userId, "MAP_COMPLETE", { key: `xp:map-complete:${userId}:${map.id}`, sourceId: map.id });
          await notify(
            tx,
            userId,
            "REWARD",
            `Map ${level} complete: ${map.name}`,
            completion.unlockedMap ? `Map ${completion.unlockedMap.level} and the next Mystery Box are now unlocked.` : "You've completed the final map of the adventure.",
            `/app/play/map?level=${level}`,
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
  const [{ seq, doneBy }, total, mapsDone] = await Promise.all([puzzleSequence(tx, userId), totalPieces(tx, userId), completedMapLevels(tx, userId)]);
  const out: CompletedPuzzle[] = [];
  for (const a of allocatePieces(seq, total)) {
    const p = seq.find((x) => x.id === a.id)!;
    if (doneBy.has(p.id) || !p.active || !a.piecesFull || !mapsDone.has(p.level)) continue;
    const [row] = await tx
      .insert(userPuzzles)
      .values({ userId, puzzleId: p.id, level: p.level, piecesRequired: p.piecesRequired, piecesTotalAt: total, prizeId: p.prizeId })
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
      result: { piecesTotal: total },
    });
    await notify(tx, userId, "REWARD", `Level ${p.level} puzzle complete`, `One final step remains to unlock ${prize?.name ?? "your prize"}.`, "/app/play/prizes");
    out.push({ puzzleId: p.id, level: p.level, name: p.name, prizeName: prize?.name ?? "" });
  }
  return out;
}

export type BigBoxResult = { openingId: string; level: number; pieces: number; totalPieces: number; completedPuzzles: CompletedPuzzle[]; replayed: boolean };

export async function openBigBox(userId: string, input: { mapId: string; idempotencyKey: string }): Promise<BigBoxResult> {
  const replay = async (): Promise<BigBoxResult | null> => {
    const [o] = await db
      .select()
      .from(bigBoxOpenings)
      .where(and(eq(bigBoxOpenings.userId, userId), eq(bigBoxOpenings.mapId, input.mapId)))
      .limit(1);
    return o ? { openingId: o.id, level: o.level, pieces: o.pieces, totalPieces: await totalPieces(db, userId), completedPuzzles: [], replayed: true } : null;
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
      if (!prog?.completedAt) throw new AppError(`Reach the final checkpoint of ${map.name} first`, "BIG_BOX_LOCKED", 403);
      const [bb] = await tx.select().from(bigMysteryBoxes).where(eq(bigMysteryBoxes.mapId, map.id)).limit(1);
      const split = bb ? [bb.pieces1Pct, bb.pieces2Pct, bb.pieces3Pct] : [];
      if (!bb || !bb.active || !isValidPercentSplit(split)) {
        throw new AppError("The Big Mystery Box is temporarily unavailable. It will be waiting for you.", "BIG_BOX_UNAVAILABLE", 503);
      }
      const pick = weightedPick(split.map((weight, i) => ({ pieces: i + 1, weight })));
      if (!pick) throw new AppError("The Big Mystery Box is temporarily unavailable.", "BIG_BOX_UNAVAILABLE", 503);
      const openingId = randomUUID();
      const odds = { pieces1Pct: bb.pieces1Pct, pieces2Pct: bb.pieces2Pct, pieces3Pct: bb.pieces3Pct, version: bb.version, updatedAt: bb.updatedAt.toISOString() };
      await tx.insert(bigBoxOpenings).values({ id: openingId, userId, mapId: map.id, bigBoxId: bb.id, level: map.level, pieces: pick.pieces, odds, idempotencyKey: input.idempotencyKey });
      await tx.insert(puzzlePieceEvents).values({ userId, delta: pick.pieces, sourceType: "big_box_opening", sourceId: openingId, level: map.level });
      const base = { userId, level: map.level, refType: "big_box_opening", refId: openingId, config: odds };
      await recordEvent(tx, { ...base, type: "BIG_MYSTERY_BOX_OPEN", actionId: openingId, result: { pieces: pick.pieces } });
      await recordEvent(tx, { ...base, type: "PUZZLE_PIECE_REWARD", actionId: openingId, result: { pieces: pick.pieces } });
      const completedPuzzles = await syncPuzzleCompletions(tx, userId);
      return { openingId, level: map.level, pieces: pick.pieces, totalPieces: await totalPieces(tx, userId), completedPuzzles, replayed: false };
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
  odds: { prizeUnlockPct: number; alternativePct: number };
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
    odds: { prizeUnlockPct: attempt.odds.prizeUnlockPct, alternativePct: attempt.odds.alternativePct },
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
        await notify(tx, userId, "REWARD", "Prize unlocked", `${prize.name} is unlocked. Claim it from the Prizes page.`, "/app/play/prizes");
      } else {
        await recordEvent(tx, { ...base, type: "ALTERNATIVE_REWARD", actionId: attemptId, result: alternativeReward ?? {}, ledgerTransactionId });
        await notify(tx, userId, "REWARD", "Alternative reward received", `${(await storedRewardDisplay(alternativeReward)) ?? "Your reward"} from the Level ${puzzle.level} final unlock.`, "/app/play/prizes");
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
    await notify(tx, claim.userId, "REWARD", "Prize claim update", `Your ${String((claim.prizeSnapshot as { name?: string }).name ?? "prize")} claim is now ${label}.`, "/app/play/prizes");
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
    if (ordered[0] && ordered[0].lootRequired < m.lootRequired) out.push(`Map ${m.level}: the first checkpoint needs less Loot than unlocking the map.`);
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
