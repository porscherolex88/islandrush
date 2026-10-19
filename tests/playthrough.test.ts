import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createAdjustment } from "@/server/services/admin-finance";
import { seedAdventure } from "@/server/content/adventure-seed";
import { getAdventureState, openBigBox, replayMap, spinPrizeWheel, unlockCheckpoint, unlockMap, claimPrize } from "@/server/services/adventure";
import { getBalances } from "@/server/services/ledger";
import { playMysteryBox } from "@/server/services/mystery-box";
import { admin, ensureAdminActor, makeUser, setConfigRaw, uid } from "./helpers";

describe("full adventure playthrough", () => {
  it("lets a fresh player reach every map, finish every puzzle and spin every prize", async () => {
    await ensureAdminActor();
    await seedAdventure();
    await setConfigRaw("limits", { gameActionsPerMinute: 1000, maxBoxOpensPerDay: null });
    const u = await makeUser();
    await db.update(profiles).set({ verificationStatus: "VERIFIED" }).where(eq(profiles.id, u.id));
    await createAdjustment(admin, { userId: u.id, account: "CREDITS", direction: "CREDIT", amount: "100000000", reason: "Simulation credits", note: "", idempotencyKey: uid() });

    for (let level = 1; level <= 10; level++) {
      let opens = 0;
      let rounds = 0;
      const before = (await getBalances(u.id)).CREDITS;
      for (let guard = 0; guard < 5000; guard++) {
        const s = await getAdventureState(u.id);
        const map = s.maps.find((m) => m.level === level)!;
        const puzzle = s.puzzles.find((p) => p.level === level)!;
        if (puzzle.canSpin) {
          const r = await spinPrizeWheel(u.id, { puzzleId: puzzle.id, idempotencyKey: uid() }, () => 0);
          if (r.claimId) await claimPrize(u.id, { claimId: r.claimId, contact: { fullName: "A", phone: "1", address: "B" } });
          break;
        }
        if (puzzle.complete) throw new Error(`Level ${level}: puzzle complete but cannot spin`);
        if (map.state === "ready") {
          await unlockMap(u.id, map.id);
          continue;
        }
        if (map.state === "locked") throw new Error(`Level ${level}: map still locked`);
        if (map.bigBox?.state === "available") {
          await openBigBox(u.id, { mapId: map.id, idempotencyKey: uid() });
          rounds++;
          continue;
        }
        if (map.canReplay) {
          await replayMap(u.id, map.id);
          continue;
        }
        const next = map.checkpoints.find((c) => c.isNext);
        if (next?.state === "available") {
          await unlockCheckpoint(u.id, next.id);
          continue;
        }
        const box = s.boxes.find((b) => b.level === level)!;
        if (box.locked) throw new Error(`Level ${level}: box locked (${box.lockReason})`);
        await playMysteryBox(u.id, { boxId: box.id, selectedIndex: 0, idempotencyKey: uid() });
        opens++;
      }
      const after = (await getBalances(u.id)).CREDITS;
      console.log(`L${level}: ${opens} opens, ${rounds} map rounds, net credits ${(Number(before) - Number(after)).toLocaleString()}`);
    }
    const s = await getAdventureState(u.id);
    expect(s.puzzles.every((p) => p.attempt)).toBe(true);
  }, 600_000);
});
