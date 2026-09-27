import "server-only";
import { AppError } from "@/lib/errors";
import { isAdminRole } from "@/lib/permissions";
import { getConfig, isFeatureEnabled } from "@/server/services/config";
import type { Profile } from "@/server/services/profiles";
import { rateLimit } from "@/server/services/rate-limit";

/** Blocks player actions during maintenance (staff are unaffected) and when a feature is switched off. */
export async function assertPlayable(user: Profile, feature?: string) {
  if (!isAdminRole(user.role)) {
    const maintenance = await getConfig("maintenance");
    if (maintenance.enabled) throw new AppError(maintenance.message, "MAINTENANCE", 503);
  }
  if (feature && !(await isFeatureEnabled(feature))) {
    throw new AppError("This feature is temporarily unavailable. Please check back soon.", "FEATURE_DISABLED", 503);
  }
}

/** Per-user rate limit for game actions, configured in `limits.gameActionsPerMinute`. */
export async function gameRateLimit(userId: string) {
  const { gameActionsPerMinute } = await getConfig("limits");
  await rateLimit(`game:${userId}`, gameActionsPerMinute, 60);
}
