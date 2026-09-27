"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { userAction } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
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
