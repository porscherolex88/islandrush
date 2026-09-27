import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { RateLimitError } from "@/lib/errors";

/** Fixed-window rate limiter backed by Postgres so it works across serverless instances. */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const interval = `${windowSeconds} seconds`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: sql`now() + ${interval}::interval` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then now() + ${interval}::interval else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });
  if (row.count > limit) throw new RateLimitError();
}
