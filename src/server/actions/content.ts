"use server";

import { z } from "zod";
import { getContentPage } from "@/server/queries/public";

const LegalSlug = z.enum(["terms", "privacy", "responsible-play"]);
export type LegalSlug = z.infer<typeof LegalSlug>;

/** Published legal page for the in-app bottom sheets; null when it is not published. */
export async function legalPageAction(slug: LegalSlug) {
  const page = await getContentPage(LegalSlug.parse(slug));
  return page ? { title: page.title, body: page.body, updatedAt: page.updatedAt.toISOString() } : null;
}
