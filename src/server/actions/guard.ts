import "server-only";
import { AppError } from "@/lib/errors";
import { isAdminRole } from "@/lib/permissions";
import { db } from "@/db";
import { getConfig, isFeatureEnabled } from "@/server/services/config";
import type { Profile } from "@/server/services/profiles";
import { rateLimit } from "@/server/services/rate-limit";

/** Blocks player actions during maintenance (staff are unaffected) and when a feature is switched off. */
export async function assertPlayable(user: Profile, feature?: string) {
  if (!isAdminRole(user.role)) {
    const maintenance = await getConfig("maintenance");
    if (maintenance.enabled) throw new AppError(maintenance.message, "MAINTENANCE", 503);
  }
  if (feature) {
    // Deposits default off when the flag row is missing; other features default on.
    const enabled = await isFeatureEnabled(feature, db, feature === "deposits" ? false : true);
    if (!enabled) {
      const message =
        feature === "deposits"
          ? "Deposits are temporarily unavailable."
          : "This feature is temporarily unavailable. Please check back soon.";
      throw new AppError(message, "FEATURE_DISABLED", 503);
    }
  }
}

/** Per-user rate limit for game actions, configured in `limits.gameActionsPerMinute`. */
export async function gameRateLimit(userId: string) {
  const { gameActionsPerMinute } = await getConfig("limits");
  await rateLimit(`game:${userId}`, gameActionsPerMinute, 60);
}
