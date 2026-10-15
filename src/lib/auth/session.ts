import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AppError, ForbiddenError, toActionError, type ActionResult } from "@/lib/errors";
import { ensureProfile, touchLastSeen, type Profile } from "@/server/services/profiles";
import { getRequestMeta } from "./request";
import { getAuth } from "./server";

export type AuthSession = { user: { id: string; email: string; name: string }; session: { id: string; createdAt: Date | string } };

/** The Neon Auth session from cookies (players only). */
export const getAuthSession = cache(async (): Promise<AuthSession | null> => {
  try {
    const { data } = await getAuth().getSession();
    if (!data?.user) return null;
    return data as unknown as AuthSession;
  } catch {
    return null;
  }
});

/** Returns the signed-in player's LootBox profile, creating it on first sight. */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const session = await getAuthSession();
  if (!session) return null;
  const meta = await getRequestMeta();
  const profile = await ensureProfile(
    { id: session.user.id, email: session.user.email, name: session.user.name },
    { ip: meta.ip, deviceId: meta.deviceId, referralCode: meta.referralCode, country: meta.country },
  );
  void touchLastSeen(profile.id).catch(() => {});
  return profile;
});

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Wraps a user server action with authentication, account-state checks and safe error handling. */
export async function userAction<T>(fn: (user: Profile) => Promise<T>, opts: { allowSuspended?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Please sign in again", "UNAUTHENTICATED", 401);
    if (!opts.allowSuspended && user.status !== "ACTIVE") throw new ForbiddenError("Your account is suspended. Please contact support.");
    return { ok: true, data: await fn(user) };
  } catch (err) {
    return toActionError(err);
  }
}

/* Staff admin auth lives in admin-session.ts (separate from player Neon Auth). */
export {
  adminAction,
  assertRecentAuth,
  getAdminContext,
  requireAdmin,
  requireAdminAllowPasswordChange,
  type AdminContext,
  type AdminUserView,
} from "./admin-session";
