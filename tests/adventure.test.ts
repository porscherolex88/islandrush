import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  bigMysteryBoxes,
  cashRewards,
  gameEvents,
  mapCheckpoints,
  maps,
  mysteryBoxPlays,
  prizeClaims,
  prizes,
  prizeUnlockAttempts,
  profiles,
  puzzles,
  userPuzzles,
} from "@/db/schema";
import { allocatePieces, checkpointStates, isValidPercentSplit } from "@/lib/adventure";
import { createAdjustment } from "@/server/services/admin-finance";
import {
  adventureConfigWarnings,
  claimPrize,
  getAdventureState,
  openBigBox,
  spinPrizeWheel,
  unlockCheckpoint,
  unlockMap,
  updatePrizeClaimStatus,
} from "@/server/services/adventure";
import { getBalances } from "@/server/services/ledger";
import { playMysteryBox } from "@/server/services/mystery-box";
import { admin, ensureAdminActor, makeBox, makeItem, makePool, makeUser, seedMissions, seedProgression, setConfigRaw, uid } from "./helpers";

async function giveCredits(userId: string, amount: number) {
  await createAdjustment(admin, { userId, account: "CREDITS", direction: "CREDIT", amount: String(amount), reason: "Test credits", note: "", idempotencyKey: uid() });
}

type Level = {
  box: Awaited<ReturnType<typeof makeBox>>;
  map: typeof maps.$inferSelect;
  checkpoints: (typeof mapCheckpoints.$inferSelect)[];
  puzzle: typeof puzzles.$inferSelect;
  prize: typeof prizes.$inferSelect;
};
const L: Record<number, Level> = {};

/** Three levels. Each box drop is 5 Loot. Map 1: unlock at 5, checkpoints at 10, 10, final 15. Maps 2-3: unlock 5, final 5. */
beforeAll(async () => {
  await seedProgression();
  await seedMissions();
  await ensureAdminActor();
  await setConfigRaw("prize_wheel", { active: true, prizeUnlockPct: 90, alternativePct: 10 });
  const prizeDefs = [
    { kind: "CREDITS" as const, amount: "5000", name: "5,000 Credits" },
    { kind: "PHYSICAL" as const, amount: "0", name: "Smartwatch", inventoryTotal: 1 },
    { kind: "CASH" as const, amount: "50.00", name: "RM50 Cash" },
  ];
  const alts = [
    ["CREDITS", "1000"],
    ["CASH", "20.00"],
    ["CREDITS", "2000"],
  ] as const;
  const odds = [
    [100, 0, 0],
    [0, 100, 0],
    [0, 0, 100],
  ];
  for (const level of [1, 2, 3]) {
    const loot = await makeItem({ name: `Loot ${level}`, kind: "LOOT", adventureLevel: level });
    const lootPool = await makePool("WEIGHTED", [{ rewardType: "ITEM", itemId: loot.id, amount: "5" }]);
    const rewardPool = await makePool("WEIGHTED", [{ rewardType: "CREDITS", amount: "100" }]);
    const box = await makeBox(rewardPool.id, 1000, { level, requiresMapLevel: level === 1 ? null : level - 1, lootPoolId: lootPool.id });
    const [map] = await db.insert(maps).values({ slug: uid("amap"), name: `Map ${level}`, level, lootRequired: 5 }).returning();
    const cpDefs =
      level === 1
        ? [
            { position: 1, name: "Camp", lootRequired: 10, isFinal: false },
            { position: 2, name: "Cave", lootRequired: 10, isFinal: false },
            { position: 3, name: "Lagoon", lootRequired: 15, isFinal: true },
          ]
        : [{ position: 1, name: `Final ${level}`, lootRequired: 5, isFinal: true }];
    const checkpoints = await db.insert(mapCheckpoints).values(cpDefs.map((c) => ({ ...c, mapId: map.id }))).returning();
    await db.insert(bigMysteryBoxes).values({ mapId: map.id, pieces1Pct: odds[level - 1][0], pieces2Pct: odds[level - 1][1], pieces3Pct: odds[level - 1][2] });
    const [prize] = await db.insert(prizes).values({ level, ...prizeDefs[level - 1] }).returning();
    const [puzzle] = await db
      .insert(puzzles)
      .values({ level, name: `Puzzle ${level}`, piecesRequired: level, prizeId: prize.id, alternativeRewardType: alts[level - 1][0], alternativeRewardAmount: alts[level - 1][1] })
      .returning();
    L[level] = { box, map, checkpoints: checkpoints.sort((a, b) => a.position - b.position), puzzle, prize };
  }
});

const open = (userId: string, level: number, key = uid("k")) => playMysteryBox(userId, { boxId: L[level].box.id, selectedIndex: 0, idempotencyKey: key });

/** Plays a level from the box to the Big Mystery Box. */
async function clearLevel(userId: string, level: number) {
  const need = Math.max(...L[level].checkpoints.map((c) => c.lootRequired));
  for (let i = 0; i < need / 5; i++) await open(userId, level);
  await unlockMap(userId, L[level].map.id);
  for (const cp of L[level].checkpoints) await unlockCheckpoint(userId, cp.id);
  return openBigBox(userId, { mapId: L[level].map.id, idempotencyKey: uid("bb") });
}

async function playerAtWheel(level: 1 | 2 | 3) {
  const u = await makeUser();
  await giveCredits(u.id, 100_000);
  for (let l = 1; l <= level; l++) await clearLevel(u.id, l);
  return u;
}

describe("adventure helpers", () => {
  it("validates percentage splits", () => {
    expect(isValidPercentSplit([90, 10])).toBe(true);
    expect(isValidPercentSplit([90, 11])).toBe(false);
    expect(isValidPercentSplit([50.5, 49.5])).toBe(false);
    expect(isValidPercentSplit([-10, 110])).toBe(false);
  });

  it("allocates pieces cumulatively in level order", () => {
    const a = allocatePieces(
      [
        { id: "b", level: 2, piecesRequired: 2 },
        { id: "a", level: 1, piecesRequired: 1 },
      ],
      2,
    );
    expect(a.map((x) => [x.id, x.piecesHave, x.piecesFull])).toEqual([
      ["a", 1, true],
      ["b", 1, false],
    ]);
  });

  it("only makes the next checkpoint available, and the final one last", () => {
    const cps = [
      { id: "f", position: 1, isFinal: true, lootRequired: 0 },
      { id: "a", position: 1, isFinal: false, lootRequired: 0 },
      { id: "b", position: 2, isFinal: false, lootRequired: 99 },
    ];
    const s = checkpointStates(cps, new Set(["a"]), 10, true);
    expect([s.get("a"), s.get("b"), s.get("f")]).toEqual(["completed", "locked", "locked"]);
    expect(checkpointStates(cps, new Set(), 10, false).get("a")).toBe("locked");
  });
});

describe("Mystery Box levels", () => {
  it("locks boxes until the previous map is completed", async () => {
    const u = await makeUser();
    await giveCredits(u.id, 10_000);
    await expect(open(u.id, 2)).rejects.toThrow(/Complete Map 1/);
    expect((await getBalances(u.id)).CREDITS).toBe(10_000n);
    const state = await getAdventureState(u.id);
    expect(state.boxes.map((b) => b.locked)).toEqual([false, true, true]);
    expect(state.currentLevel).toBe(1);
  });

  it("deducts Credits once, grants the reward and Loot, and records events", async () => {
    const u = await makeUser();
    await giveCredits(u.id, 5000);
    const key = uid("k");
    const res = await open(u.id, 1, key);
    const again = await open(u.id, 1, key);
    expect(res.loot).toHaveLength(1);
    expect(again.playId).toBe(res.playId);
    expect((await getBalances(u.id)).CREDITS).toBe(5000n - 1000n + 100n);
    const plays = await db.select().from(mysteryBoxPlays).where(eq(mysteryBoxPlays.userId, u.id));
    expect(plays).toHaveLength(1);
    expect(plays[0].level).toBe(1);
    const events = await db.select({ type: gameEvents.type }).from(gameEvents).where(eq(gameEvents.userId, u.id));
    expect(events.map((e) => e.type).sort()).toEqual(["LOOT_REWARD", "MYSTERY_BOX_PURCHASE", "MYSTERY_BOX_REWARD"]);
    const state = await getAdventureState(u.id);
    expect(state.maps[0].lootCollected).toBe(5);
    expect(state.maps[0].state).toBe("ready");
  });

  it("rejects insufficient Credits without side effects", async () => {
    const u = await makeUser();
    await giveCredits(u.id, 999);
    await expect(open(u.id, 1)).rejects.toThrow(/Not enough Credits/);
    expect((await getBalances(u.id)).CREDITS).toBe(999n);
    expect((await getAdventureState(u.id)).maps[0].lootCollected).toBe(0);
  });
});

describe("maps and checkpoints", () => {
  it("requires Loot to unlock a map and is idempotent", async () => {
    const u = await makeUser();
    await giveCredits(u.id, 10_000);
    await expect(unlockMap(u.id, L[1].map.id)).rejects.toThrow(/Collect 5 more Loot/);
    await open(u.id, 1);
    const first = await unlockMap(u.id, L[1].map.id);
    const second = await unlockMap(u.id, L[1].map.id);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(gameEvents)
      .where(and(eq(gameEvents.userId, u.id), eq(gameEvents.type, "MAP_UNLOCK")));
    expect(n).toBe(1);
  });

  it("keeps the next map locked until the previous map is completed", async () => {
    const u = await makeUser();
    await expect(unlockMap(u.id, L[2].map.id)).rejects.toThrow(/Complete Map 1/);
  });

  it("enforces checkpoint order and Loot thresholds, and Loot is never consumed", async () => {
    const u = await makeUser();
    await giveCredits(u.id, 10_000);
    await open(u.id, 1);
    await unlockMap(u.id, L[1].map.id);
    const [camp, cave, lagoon] = L[1].checkpoints;
    await expect(unlockCheckpoint(u.id, camp.id)).rejects.toThrow(/Collect 5 more Loot/);
    await open(u.id, 1);
    await expect(unlockCheckpoint(u.id, cave.id)).rejects.toThrow(/Discover Camp first/);
    await expect(unlockCheckpoint(u.id, lagoon.id)).rejects.toThrow(/Discover Camp first/);
    await unlockCheckpoint(u.id, camp.id);
    expect((await unlockCheckpoint(u.id, camp.id)).replayed).toBe(true);
    await unlockCheckpoint(u.id, cave.id);
    const state = await getAdventureState(u.id);
    expect(state.maps[0].lootCollected).toBe(10);
    expect(state.maps[0].checkpointsDone).toBe(2);
    expect(state.nextStep.kind).toBe("loot");
  });

  it("completes the map on the final checkpoint and unlocks the next map and box", async () => {
    const u = await makeUser();
    await giveCredits(u.id, 10_000);
    for (let i = 0; i < 3; i++) await open(u.id, 1);
    await unlockMap(u.id, L[1].map.id);
    const results = [];
    for (const cp of L[1].checkpoints) results.push(await unlockCheckpoint(u.id, cp.id));
    const final = results.at(-1)!;
    expect(final.isFinal).toBe(true);
    expect(final.completion?.unlockedMap?.level).toBe(2);
    expect(final.completion?.unlockedBoxes.map((b) => b.level)).toEqual([2]);
    expect(final.bigBox).not.toBeNull();
    const state = await getAdventureState(u.id);
    expect(state.maps[0].state).toBe("completed");
    expect(state.maps[1].state).toBe("collecting");
    expect(state.boxes[1].locked).toBe(false);
    expect(state.currentLevel).toBe(2);
    expect(state.nextStep.kind).toBe("bigbox");
  });
});

describe("Big Mystery Box and puzzles", () => {
  it("cannot be opened before the map is completed", async () => {
    const u = await makeUser();
    await expect(openBigBox(u.id, { mapId: L[1].map.id, idempotencyKey: uid() })).rejects.toThrow(/final checkpoint/);
  });

  it("opens once, grants pieces, and completes puzzles in order", async () => {
    const u = await makeUser();
    await giveCredits(u.id, 100_000);
    const first = await clearLevel(u.id, 1);
    expect(first.pieces).toBe(1);
    expect(first.completedPuzzles.map((p) => p.level)).toEqual([1]);
    const replay = await openBigBox(u.id, { mapId: L[1].map.id, idempotencyKey: uid() });
    expect(replay.replayed).toBe(true);
    expect(replay.totalPieces).toBe(1);

    const second = await clearLevel(u.id, 2);
    expect(second.pieces).toBe(2);
    expect(second.totalPieces).toBe(3);
    expect(second.completedPuzzles.map((p) => p.level)).toEqual([2]);
    const state = await getAdventureState(u.id);
    expect(state.puzzles.map((p) => [p.piecesHave, p.complete])).toEqual([
      [1, true],
      [2, true],
      [0, false],
    ]);
    expect(state.nextStep.kind).toBe("wheel");
  });

  it("does not complete a puzzle until its map is completed even with enough pieces", async () => {
    const u = await makeUser();
    await giveCredits(u.id, 100_000);
    await clearLevel(u.id, 1);
    const done = await db.select().from(userPuzzles).where(eq(userPuzzles.userId, u.id));
    expect(done.map((d) => d.level)).toEqual([1]);
  });
});

describe("Final Prize Unlock wheel", () => {
  it("requires a completed puzzle", async () => {
    const u = await makeUser();
    await expect(spinPrizeWheel(u.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() })).rejects.toThrow(/Complete this puzzle/);
  });

  it("unlocks the prize on a winning roll, only once, and pays Credits prizes through the ledger on claim", async () => {
    const u = await playerAtWheel(1);
    const before = (await getBalances(u.id)).CREDITS;
    const res = await spinPrizeWheel(u.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() }, () => 0);
    expect(res.outcome).toBe("PRIZE");
    expect(res.odds).toEqual({ prizeUnlockPct: 90, alternativePct: 10 });
    const replay = await spinPrizeWheel(u.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() }, () => 99);
    expect(replay.replayed).toBe(true);
    expect(replay.outcome).toBe("PRIZE");
    expect(await db.select().from(prizeUnlockAttempts).where(eq(prizeUnlockAttempts.userId, u.id))).toHaveLength(1);

    const claim = await claimPrize(u.id, { claimId: res.claimId!, contact: {} });
    expect(claim.status).toBe("FULFILLED");
    expect((await claimPrize(u.id, { claimId: res.claimId!, contact: {} })).replayed).toBe(true);
    expect((await getBalances(u.id)).CREDITS).toBe(before + 5000n);
  });

  it("grants the alternative reward through the ledger on a losing roll", async () => {
    const u = await playerAtWheel(1);
    const before = (await getBalances(u.id)).CREDITS;
    const res = await spinPrizeWheel(u.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() }, () => 90);
    expect(res.outcome).toBe("ALTERNATIVE");
    expect(res.claimId).toBeNull();
    expect((await getBalances(u.id)).CREDITS).toBe(before + 1000n);
    const [attempt] = await db.select().from(prizeUnlockAttempts).where(eq(prizeUnlockAttempts.userId, u.id));
    expect(attempt.ledgerTransactionId).not.toBeNull();
    expect(attempt.roll).toBe(90);
  });

  it("puts Cash alternatives into pending rewards, not withdrawable balance", async () => {
    const u = await playerAtWheel(2);
    await spinPrizeWheel(u.id, { puzzleId: L[2].puzzle.id, idempotencyKey: uid() }, () => 95);
    const bal = await getBalances(u.id);
    expect(bal.PENDING_REWARDS).toBe(2000n);
    expect(bal.WITHDRAWABLE).toBe(0n);
    const rows = await db.select().from(cashRewards).where(and(eq(cashRewards.userId, u.id), eq(cashRewards.sourceType, "prize_unlock_attempt")));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PENDING");
  });

  it("follows the configured odds (100% and 0%) with the real RNG", async () => {
    await setConfigRaw("prize_wheel", { active: true, prizeUnlockPct: 0, alternativePct: 100 });
    const a = await playerAtWheel(1);
    expect((await spinPrizeWheel(a.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() })).outcome).toBe("ALTERNATIVE");
    await setConfigRaw("prize_wheel", { active: true, prizeUnlockPct: 100, alternativePct: 0 });
    const b = await playerAtWheel(1);
    expect((await spinPrizeWheel(b.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() })).outcome).toBe("PRIZE");
    await setConfigRaw("prize_wheel", { active: true, prizeUnlockPct: 90, alternativePct: 10 });
  });

  it("refuses to spin when the odds do not total 100%", async () => {
    await setConfigRaw("prize_wheel", { active: true, prizeUnlockPct: 90, alternativePct: 5 });
    const u = await playerAtWheel(1);
    await expect(spinPrizeWheel(u.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() })).rejects.toThrow(/temporarily unavailable/);
    await setConfigRaw("prize_wheel", { active: true, prizeUnlockPct: 90, alternativePct: 10 });
    expect(await db.select().from(prizeUnlockAttempts).where(eq(prizeUnlockAttempts.userId, u.id))).toHaveLength(0);
  });
});

describe("physical prize claims", () => {
  it("reserves inventory, needs contact details, and follows admin review transitions", async () => {
    const u = await playerAtWheel(2);
    const res = await spinPrizeWheel(u.id, { puzzleId: L[2].puzzle.id, idempotencyKey: uid() }, () => 0);
    expect(res.outcome).toBe("PRIZE");
    const [prize] = await db.select().from(prizes).where(eq(prizes.id, L[2].prize.id));
    expect(prize.inventoryAllocated).toBe(1);

    const other = await playerAtWheel(2);
    await expect(spinPrizeWheel(other.id, { puzzleId: L[2].puzzle.id, idempotencyKey: uid() }, () => 0)).rejects.toThrow(/temporarily unavailable/);
    expect(await db.select().from(prizeUnlockAttempts).where(eq(prizeUnlockAttempts.userId, other.id))).toHaveLength(0);

    await expect(claimPrize(u.id, { claimId: res.claimId!, contact: { fullName: "A" } })).rejects.toThrow(/delivery address/);
    const claimed = await claimPrize(u.id, { claimId: res.claimId!, contact: { fullName: "Aisha", phone: "0123456789", address: "1 Jalan Test" } });
    expect(claimed.status).toBe("CLAIM_PENDING");

    await expect(updatePrizeClaimStatus(admin, { claimId: res.claimId!, status: "FULFILLED", note: "" })).rejects.toThrow(/cannot move/);
    await updatePrizeClaimStatus(admin, { claimId: res.claimId!, status: "UNDER_REVIEW", note: "" });
    await updatePrizeClaimStatus(admin, { claimId: res.claimId!, status: "REJECTED", note: "Duplicate account" });
    const [after] = await db.select().from(prizes).where(eq(prizes.id, L[2].prize.id));
    expect(after.inventoryAllocated).toBe(0);
    const [row] = await db.select().from(prizeClaims).where(eq(prizeClaims.id, res.claimId!));
    expect(row.status).toBe("REJECTED");
  });

  it("requires verification when the prize demands it", async () => {
    await db.update(prizes).set({ requiresVerification: true }).where(eq(prizes.id, L[1].prize.id));
    const u = await playerAtWheel(1);
    await expect(spinPrizeWheel(u.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() }, () => 0)).rejects.toThrow(/verify your account/);
    await db.update(profiles).set({ verificationStatus: "VERIFIED" }).where(eq(profiles.id, u.id));
    expect((await spinPrizeWheel(u.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() }, () => 0)).outcome).toBe("PRIZE");
    await db.update(prizes).set({ requiresVerification: false }).where(eq(prizes.id, L[1].prize.id));
  });
});

describe("audit trail", () => {
  it("records an immutable event for every step", async () => {
    const u = await playerAtWheel(1);
    await spinPrizeWheel(u.id, { puzzleId: L[1].puzzle.id, idempotencyKey: uid() }, () => 0);
    const types = new Set((await db.select({ type: gameEvents.type }).from(gameEvents).where(eq(gameEvents.userId, u.id))).map((e) => e.type));
    for (const t of [
      "MYSTERY_BOX_PURCHASE",
      "MYSTERY_BOX_REWARD",
      "LOOT_REWARD",
      "MAP_UNLOCK",
      "MAP_CHECKPOINT_UNLOCK",
      "MAP_COMPLETION",
      "BIG_MYSTERY_BOX_OPEN",
      "PUZZLE_PIECE_REWARD",
      "PUZZLE_COMPLETED",
      "PRIZE_UNLOCK_ATTEMPT",
      "PRIZE_UNLOCK_RESULT",
    ] as const) {
      expect(types.has(t)).toBe(true);
    }
    await expect(db.update(gameEvents).set({ level: 9 }).where(eq(gameEvents.userId, u.id))).rejects.toThrow();
    await expect(db.delete(prizeUnlockAttempts).where(eq(prizeUnlockAttempts.userId, u.id))).rejects.toThrow();
  });

  it("reports no configuration warnings for a complete setup", async () => {
    expect(await adventureConfigWarnings()).toEqual([]);
  });
});
