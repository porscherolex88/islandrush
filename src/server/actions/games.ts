"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { userAction } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { claimPrize, openBigBox, spinPrizeWheel, unlockCheckpoint, unlockMap, type ClaimContact } from "@/server/services/adventure";
import { claimDailyEvent, claimDailyLogin, claimMissionBonus, spinDaily } from "@/server/services/daily";
import { discoverTile, unlockArea } from "@/server/services/map";
import { playMysteryBox } from "@/server/services/mystery-box";
import { unlockVault } from "@/server/services/vault";
import { assertPlayable, gameRateLimit } from "./guard";

const uuid = z.string().uuid();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new AppError("Invalid request");
  return r.data;
}

export async function claimLoginAction() {
  return userAction(async (user) => {
    await assertPlayable(user);
    const result = await claimDailyLogin(user.id);
    revalidatePath("/app", "layout");
    return result;
  });
}

export async function spinAction() {
  return userAction(async (user) => {
    await assertPlayable(user, "daily_spin");
    await gameRateLimit(user.id);
    const result = await spinDaily(user.id);
    return result;
  });
}

export async function claimMissionBonusAction() {
  return userAction(async (user) => {
    await assertPlayable(user);
    const result = await claimMissionBonus(user.id);
    revalidatePath("/app", "layout");
    return result;
  });
}

export async function claimEventAction() {
  return userAction(async (user) => {
    await assertPlayable(user);
    await gameRateLimit(user.id);
    return claimDailyEvent(user.id);
  });
}

export async function playBoxAction(input: { boxId: string; selectedIndex: number; idempotencyKey: string }) {
  return userAction(async (user) => {
    const data = parse(
      z.object({ boxId: uuid, selectedIndex: z.number().int().min(0).max(8), idempotencyKey: z.string().min(8).max(100) }),
      input,
    );
    await assertPlayable(user, "mystery_box");
    await gameRateLimit(user.id);
    return playMysteryBox(user.id, data);
  });
}

/** Opens an adventure Mystery Box level. The reward and Loot are decided on the server. */
export async function openBoxAction(input: { boxId: string; idempotencyKey: string }) {
  return userAction(async (user) => {
    const data = parse(z.object({ boxId: uuid, idempotencyKey: z.string().min(8).max(100) }), input);
    await assertPlayable(user, "mystery_box");
    await gameRateLimit(user.id);
    return playMysteryBox(user.id, { ...data, selectedIndex: 0 });
  });
}

export async function unlockMapAction(mapId: string) {
  return userAction(async (user) => {
    const id = parse(uuid, mapId);
    await assertPlayable(user, "mystery_map");
    await gameRateLimit(user.id);
    return unlockMap(user.id, id);
  });
}

export async function unlockCheckpointAction(checkpointId: string) {
  return userAction(async (user) => {
    const id = parse(uuid, checkpointId);
    await assertPlayable(user, "mystery_map");
    await gameRateLimit(user.id);
    return unlockCheckpoint(user.id, id);
  });
}

export async function openBigBoxAction(input: { mapId: string; idempotencyKey: string }) {
  return userAction(async (user) => {
    const data = parse(z.object({ mapId: uuid, idempotencyKey: z.string().min(8).max(100) }), input);
    await assertPlayable(user, "mystery_map");
    await gameRateLimit(user.id);
    return openBigBox(user.id, data);
  });
}

export async function spinPrizeWheelAction(input: { puzzleId: string; idempotencyKey: string }) {
  return userAction(async (user) => {
    const data = parse(z.object({ puzzleId: uuid, idempotencyKey: z.string().min(8).max(100) }), input);
    await assertPlayable(user, "prize_wheel");
    await gameRateLimit(user.id);
    return spinPrizeWheel(user.id, data);
  });
}

export async function claimPrizeAction(input: { claimId: string; contact: ClaimContact }) {
  return userAction(async (user) => {
    const data = parse(
      z.object({
        claimId: uuid,
        contact: z.object({
          fullName: z.string().trim().max(120).optional(),
          phone: z.string().trim().max(40).optional(),
          address: z.string().trim().max(500).optional(),
          note: z.string().trim().max(500).optional(),
        }),
      }),
      input,
    );
    await assertPlayable(user);
    await gameRateLimit(user.id);
    const result = await claimPrize(user.id, data);
    revalidatePath("/app", "layout");
    return result;
  });
}

export async function discoverTileAction(tileId: string) {
  return userAction(async (user) => {
    const id = parse(uuid, tileId);
    await assertPlayable(user, "mystery_map");
    await gameRateLimit(user.id);
    return discoverTile(user.id, id);
  });
}

export async function unlockAreaAction(areaId: string) {
  return userAction(async (user) => {
    const id = parse(uuid, areaId);
    await assertPlayable(user, "mystery_map");
    await gameRateLimit(user.id);
    const { area, rewards, xp } = await unlockArea(user.id, id);
    return { areaName: area.name, areaIcon: area.icon, isSpecial: area.isSpecial, rewards, xp };
  });
}

export async function unlockVaultAction(vaultId: string) {
  return userAction(async (user) => {
    const id = parse(uuid, vaultId);
    await assertPlayable(user, "vault");
    await gameRateLimit(user.id);
    const { vault, rewards, xp } = await unlockVault(user.id, id);
    return { vaultName: vault.name, vaultIcon: vault.icon, rewards, xp };
  });
}
