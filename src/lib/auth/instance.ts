import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

type LootboxAuth = ReturnType<typeof betterAuth>;

const globalForAuth = globalThis as unknown as { __lootboxAuthPool?: Pool; __lootboxBetterAuth?: LootboxAuth };

function authPool(): Pool {
  if (!globalForAuth.__lootboxAuthPool) {
    const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not configured");
    globalForAuth.__lootboxAuthPool = new Pool({
      connectionString,
      max: 5,
      ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : undefined,
      options: "-c search_path=neon_auth,public",
    });
  }
  return globalForAuth.__lootboxAuthPool;
}

function baseUrl() {
  const url = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function getBetterAuth(): LootboxAuth {
  if (!globalForAuth.__lootboxBetterAuth) {
    const secret = process.env.NEON_AUTH_COOKIE_SECRET ?? process.env.BETTER_AUTH_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("NEON_AUTH_COOKIE_SECRET (or BETTER_AUTH_SECRET) must be at least 32 characters");
    }
    globalForAuth.__lootboxBetterAuth = betterAuth({
      database: authPool(),
      secret,
      baseURL: baseUrl(),
      emailAndPassword: { enabled: true },
      plugins: [nextCookies()],
    }) as unknown as LootboxAuth;
  }
  return globalForAuth.__lootboxBetterAuth;
}
