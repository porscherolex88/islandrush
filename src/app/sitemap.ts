import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { publishedBlogSitemapEntries, publishedHelpArticles } from "@/server/queries/public";

const STATIC: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/games", changeFrequency: "monthly", priority: 0.8 },
  { path: "/rewards", changeFrequency: "monthly", priority: 0.7 },
  { path: "/referrals", changeFrequency: "monthly", priority: 0.6 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/help", changeFrequency: "weekly", priority: 0.7 },
  { path: "/blog", changeFrequency: "daily", priority: 0.8 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/responsible-play", changeFrequency: "yearly", priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC.map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  let helpEntries: MetadataRoute.Sitemap = [];
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const [articles, posts] = await Promise.all([publishedHelpArticles(), publishedBlogSitemapEntries()]);
    helpEntries = articles.map((a) => ({
      url: absoluteUrl(`/help/${a.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
    blogEntries = posts.map((p) => ({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: p.updatedAt ?? p.publishedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB unavailable at build time: still ship the static public pages.
  }

  return [...staticEntries, ...helpEntries, ...blogEntries];
}
