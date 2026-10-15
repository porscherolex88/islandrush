/**
 * Applies Compliance-approved FAQ and Help copy from
 * scripts/content/compliance-faq-help.json.
 *
 * FAQ and Help are stored in the database (managed under /admin), not in page code.
 * This script does NOT run on deploy. Apply it deliberately against the target DB:
 *
 *   npm run db:seed:compliance-content
 *
 * Requires DATABASE_URL (or .env.local). Idempotent via app_config key
 * `compliance_content_v1`. Pass --force to re-apply.
 *
 * Admin alternative: import rows manually from the JSON under
 * Admin > Content > FAQ and Admin > Content > Help Articles.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

type FaqRow = { category: string; sortOrder: number; question: string; answer: string };
type HelpRow = { slug: string; title: string; category: string; summary: string; body: string };
type PageRow = { slug: string; title: string; body: string };
type Payload = {
  version: string;
  faqs: FaqRow[];
  helpArticles: HelpRow[];
  retireHelpSlugs?: string[];
  contentPages?: PageRow[];
};

async function main() {
  const force = process.argv.includes("--force");
  const file = path.resolve(__dirname, "content/compliance-faq-help.json");
  const data = JSON.parse(readFileSync(file, "utf8")) as Payload;

  const { db } = await import("@/db");
  const s = await import("@/db/schema");

  const [done] = await db.select().from(s.appConfig).where(eq(s.appConfig.key, data.version));
  if (done && !force) {
    console.log(`${data.version} already applied. Re-run with --force to replace FAQ/Help again.`);
    return;
  }

  await db.transaction(async (tx) => {
    // Replace the public FAQ set with the approved entries.
    await tx.delete(s.faqs);
    if (data.faqs.length) {
      await tx.insert(s.faqs).values(
        data.faqs.map((f) => ({
          category: f.category,
          sortOrder: f.sortOrder,
          question: f.question,
          answer: f.answer,
          status: "PUBLISHED" as const,
        })),
      );
    }

    for (const slug of data.retireHelpSlugs ?? []) {
      await tx.update(s.helpArticles).set({ status: "ARCHIVED", updatedAt: new Date() }).where(eq(s.helpArticles.slug, slug));
    }

    for (const a of data.helpArticles) {
      await tx
        .insert(s.helpArticles)
        .values({
          slug: a.slug,
          title: a.title,
          category: a.category,
          summary: a.summary,
          body: a.body,
          status: "PUBLISHED",
        })
        .onConflictDoUpdate({
          target: s.helpArticles.slug,
          set: {
            title: a.title,
            category: a.category,
            summary: a.summary,
            body: a.body,
            status: "PUBLISHED",
            updatedAt: new Date(),
          },
        });
    }

    for (const p of data.contentPages ?? []) {
      await tx
        .insert(s.contentPages)
        .values({ slug: p.slug, title: p.title, body: p.body, status: "PUBLISHED" })
        .onConflictDoUpdate({
          target: s.contentPages.slug,
          set: { title: p.title, body: p.body, status: "PUBLISHED", updatedAt: new Date() },
        });
    }

    await tx
      .insert(s.appConfig)
      .values({ key: data.version, value: { appliedAt: new Date().toISOString(), force } })
      .onConflictDoUpdate({
        target: s.appConfig.key,
        set: { value: { appliedAt: new Date().toISOString(), force }, updatedAt: new Date() },
      });
  });

  console.log(`Applied ${data.version}: ${data.faqs.length} FAQs, ${data.helpArticles.length} help articles.`);
  console.log("Review under /admin (FAQ and Help Articles). Public pages revalidate within a few minutes.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
