import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { contentPages, depositLevels, faqs, helpArticles, mysteryBoxes, referralLevels } from "@/db/schema";
import { getConfig } from "@/server/services/config";

export const getContentPage = cache(async (slug: string) => {
  const [row] = await db
    .select()
    .from(contentPages)
    .where(and(eq(contentPages.slug, slug), eq(contentPages.status, "PUBLISHED")))
    .limit(1);
  return row ?? null;
});

export async function publishedFaqs() {
  return db.select().from(faqs).where(eq(faqs.status, "PUBLISHED")).orderBy(asc(faqs.sortOrder));
}

export async function publishedHelpArticles() {
  return db
    .select({ slug: helpArticles.slug, title: helpArticles.title, summary: helpArticles.summary, category: helpArticles.category })
    .from(helpArticles)
    .where(eq(helpArticles.status, "PUBLISHED"))
    .orderBy(asc(helpArticles.category), asc(helpArticles.title));
}

export const getHelpArticle = cache(async (slug: string) => {
  const [row] = await db
    .select()
    .from(helpArticles)
    .where(and(eq(helpArticles.slug, slug), eq(helpArticles.status, "PUBLISHED")))
    .limit(1);
  return row ?? null;
});

export async function publicGameFacts() {
  const [boxes, conversion] = await Promise.all([
    db
      .select({ name: mysteryBoxes.name, priceCredits: mysteryBoxes.priceCredits, description: mysteryBoxes.description })
      .from(mysteryBoxes)
      .where(eq(mysteryBoxes.status, "PUBLISHED"))
      .orderBy(asc(mysteryBoxes.sortOrder)),
    getConfig("conversion"),
  ]);
  return { boxes, conversion };
}

export async function publicRewardFacts() {
  const [levels, rewards, withdrawal] = await Promise.all([
    db.select({ name: depositLevels.name, threshold: depositLevels.threshold, benefits: depositLevels.benefits, color: depositLevels.color }).from(depositLevels).orderBy(asc(depositLevels.sortOrder)),
    getConfig("rewards"),
    getConfig("withdrawal"),
  ]);
  return { levels, rewards, withdrawal };
}

export async function publicReferralFacts() {
  const [levels, referral] = await Promise.all([
    db.select().from(referralLevels).where(eq(referralLevels.active, true)).orderBy(asc(referralLevels.level)),
    getConfig("referral"),
  ]);
  return { levels, referral };
}
