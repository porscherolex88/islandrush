import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { isDatabaseConfigured } from "@/db/env";
import { banners } from "@/db/schema";

/** Published banners/announcements inside their scheduling window. */
export async function activeBanners(kind?: "BANNER" | "ANNOUNCEMENT") {
  if (!isDatabaseConfigured()) return [];
  const now = new Date();
  return db
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.status, "PUBLISHED"),
        kind ? eq(banners.kind, kind) : undefined,
        or(isNull(banners.startsAt), lte(banners.startsAt, now)),
        or(isNull(banners.endsAt), gt(banners.endsAt, now)),
      ),
    )
    .orderBy(desc(banners.updatedAt))
    .limit(3);
}
