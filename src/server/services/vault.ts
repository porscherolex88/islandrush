import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vaults, vaultUnlocks } from "@/db/schema";
import { AppError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import { checkAchievements } from "./achievements";
import { lockPlayer } from "./guards";
import { notify } from "./notifications";
import { consumeRequirements, evaluateRequirements } from "./requirements";
import { grantPool } from "./rewards";

export async function getVaultStates(userId: string) {
  const list = await db.select().from(vaults).where(eq(vaults.status, "PUBLISHED")).orderBy(asc(vaults.sortOrder));
  const unlocks = await db.select().from(vaultUnlocks).where(eq(vaultUnlocks.userId, userId));
  return Promise.all(
    list.map(async (v) => {
      const unlock = unlocks.find((u) => u.vaultId === v.id) ?? null;
      const reqs = await evaluateRequirements(db, userId, "VAULT", v.id);
      return {
        ...v,
        unlocked: Boolean(unlock),
        unlock,
        requirements: reqs,
        ready: !unlock && reqs.length > 0 && reqs.every((r) => r.met),
        progress: reqs.length ? Math.round((reqs.filter((r) => r.met).length / reqs.length) * 100) : 0,
      };
    }),
  );
}

/** Unlocks a Vault after validating (and optionally consuming) every requirement server-side. */
export async function unlockVault(userId: string, vaultId: string) {
  try {
    return await db.transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const [vault] = await tx.select().from(vaults).where(eq(vaults.id, vaultId)).limit(1);
      if (!vault || vault.status !== "PUBLISHED") throw new NotFoundError("Vault not found");
      const [already] = await tx
        .select({ id: vaultUnlocks.id })
        .from(vaultUnlocks)
        .where(and(eq(vaultUnlocks.userId, userId), eq(vaultUnlocks.vaultId, vault.id)))
        .limit(1);
      if (already) throw new AppError("You've already opened this Vault", "ALREADY_UNLOCKED");
      const statuses = await evaluateRequirements(tx, userId, "VAULT", vault.id);
      if (!statuses.length || !statuses.every((s) => s.met)) throw new AppError("The Vault requirements are not complete yet", "REQUIREMENTS_UNMET");

      const [unlock] = await tx.insert(vaultUnlocks).values({ userId, vaultId: vault.id }).returning();
      const consumed = await consumeRequirements(tx, userId, statuses, { sourceType: "vault_unlock", sourceId: unlock.id });
      const rewards = await grantPool(tx, userId, vault.rewardPoolId, {
        sourceType: "vault_unlock",
        sourceId: unlock.id,
        key: `vault:${userId}:${vault.id}`,
      });
      await tx.update(vaultUnlocks).set({ consumed, rewards }).where(eq(vaultUnlocks.id, unlock.id));
      await checkAchievements(tx, userId, "VAULTS_UNLOCKED");
      await notify(tx, userId, "REWARD", `${vault.icon} ${vault.name} opened!`, rewards.map((r) => r.display).join(", ") || "The Vault is yours.", "/app/play/vault");
      return { vault, rewards, consumed };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("You've already opened this Vault", "ALREADY_UNLOCKED");
    throw err;
  }
}
