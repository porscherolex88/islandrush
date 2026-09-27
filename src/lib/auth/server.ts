import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuth = ReturnType<typeof createNeonAuth>;

const globalForAuth = globalThis as unknown as { __lootboxAuth?: NeonAuth };

/** Lazily-created Neon Auth (managed Better Auth) instance. */
export function getAuth(): NeonAuth {
  if (!globalForAuth.__lootboxAuth) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !secret) throw new Error("NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be configured");
    globalForAuth.__lootboxAuth = createNeonAuth({
      baseUrl,
      cookies: { secret, sameSite: "lax" },
      logLevel: "error",
    });
  }
  return globalForAuth.__lootboxAuth;
}
