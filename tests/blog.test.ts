import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { blogArticleJsonLd, blogCanonicalUrl, blogMetaDescription, blogPageTitle, blogPostMetadata } from "@/lib/blog";
import { COMPANY_NAME } from "@/lib/company";
import { getResourceDef } from "@/lib/admin/resource-fields";
import { parseValues } from "@/server/admin/resources";
import { getPublishedBlogPost, publishedBlogPosts, publishedBlogSitemapEntries } from "@/server/queries/public";

async function insertPost(input: Partial<typeof blogPosts.$inferInsert> & { slug: string; title: string; body: string }) {
  const [row] = await db
    .insert(blogPosts)
    .values({
      excerpt: "",
      coverImageAlt: "",
      seoTitle: "",
      seoDescription: "",
      status: "DRAFT",
      ...input,
    })
    .returning();
  return row;
}

describe("blog admin resource", () => {
  it("registers a content.manage CRUD resource with the expected fields", () => {
    const def = getResourceDef("blogPosts");
    expect(def).toBeTruthy();
    expect(def?.permission).toBe("content.manage");
    expect(def?.deletable).toBe(true);
    const names = def!.fields.map((f) => f.name);
    for (const required of [
      "title",
      "slug",
      "excerpt",
      "body",
      "coverImageUrl",
      "coverImageAlt",
      "seoTitle",
      "seoDescription",
      "status",
      "publishedAt",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("requires a publish date when publishing and validates cover URLs", () => {
    const def = getResourceDef("blogPosts")!;
    expect(() =>
      parseValues(
        "blogPosts",
        def,
        { slug: "hello", title: "Hello", body: "Hi", status: "PUBLISHED", publishedAt: "" },
        false,
      ),
    ).toThrow(/Publish date/i);

    expect(() =>
      parseValues(
        "blogPosts",
        def,
        {
          slug: "hello",
          title: "Hello",
          body: "Hi",
          status: "DRAFT",
          coverImageUrl: "javascript:alert(1)",
        },
        false,
      ),
    ).toThrow(/Cover image URL/i);

    const values = parseValues(
      "blogPosts",
      def,
      {
        slug: "hello-world",
        title: "Hello",
        excerpt: "Short",
        body: "# Hi\n\nWorld",
        coverImageUrl: "https://cdn.example.com/cover.jpg",
        coverImageAlt: "Cover",
        seoTitle: "SEO Hello",
        seoDescription: "SEO desc",
        status: "PUBLISHED",
        publishedAt: "2026-01-15T10:00:00.000Z",
      },
      false,
    );
    expect(values.slug).toBe("hello-world");
    expect(values.status).toBe("PUBLISHED");
    expect(values.publishedAt).toBeInstanceOf(Date);
    expect(values.coverImageAlt).toBe("Cover");
  });
});

describe("blog public queries", () => {
  it("lists only published posts with a publish date in the past", async () => {
    const published = await insertPost({
      slug: `pub-${Date.now()}`,
      title: "Published post",
      excerpt: "On the list",
      body: "Body",
      status: "PUBLISHED",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      coverImageUrl: "https://cdn.example.com/a.jpg",
      coverImageAlt: "Alt text",
    });
    await insertPost({
      slug: `draft-${Date.now()}`,
      title: "Draft post",
      body: "Secret",
      status: "DRAFT",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    });
    await insertPost({
      slug: `future-${Date.now()}`,
      title: "Scheduled post",
      body: "Later",
      status: "PUBLISHED",
      publishedAt: new Date(Date.now() + 86_400_000),
    });

    const list = await publishedBlogPosts();
    expect(list.some((p) => p.slug === published.slug)).toBe(true);
    expect(list.some((p) => p.title === "Draft post")).toBe(false);
    expect(list.some((p) => p.title === "Scheduled post")).toBe(false);

    const bySlug = await getPublishedBlogPost(published.slug);
    expect(bySlug?.title).toBe("Published post");
    expect(bySlug?.coverImageAlt).toBe("Alt text");
    expect(await getPublishedBlogPost(`draft-${Date.now()}`)).toBeNull();

    const sitemap = await publishedBlogSitemapEntries();
    expect(sitemap.some((e) => e.slug === published.slug)).toBe(true);
    expect(sitemap.every((e) => e.publishedAt != null)).toBe(true);
  });
});

describe("blog SEO helpers", () => {
  it("builds canonical, meta, Open Graph and Article JSON-LD for LootBox Games Pte Ltd", () => {
    const post = {
      slug: "welcome",
      title: "Welcome to LootBox",
      excerpt: "A short excerpt",
      seoTitle: "Welcome | Official",
      seoDescription: "SEO description here",
      coverImageUrl: "https://cdn.example.com/og.jpg",
      coverImageAlt: "Loot chest",
      publishedAt: new Date("2026-03-01T12:00:00Z"),
      updatedAt: new Date("2026-03-02T12:00:00Z"),
    };

    expect(blogPageTitle(post)).toBe("Welcome | Official");
    expect(blogMetaDescription(post)).toBe("SEO description here");
    expect(blogCanonicalUrl(post.slug)).toMatch(/\/blog\/welcome$/);

    const meta = blogPostMetadata(post);
    expect(meta.alternates).toEqual({ canonical: blogCanonicalUrl("welcome") });
    expect(meta.openGraph).toMatchObject({
      type: "article",
      title: "Welcome | Official",
      description: "SEO description here",
      url: blogCanonicalUrl("welcome"),
    });
    expect(meta.robots).toEqual({ index: true, follow: true });

    const ld = blogArticleJsonLd(post);
    expect(ld["@type"]).toBe("Article");
    expect(ld.headline).toBe("Welcome | Official");
    expect(ld.description).toBe("SEO description here");
    expect(ld.image).toEqual(["https://cdn.example.com/og.jpg"]);
    expect(ld.datePublished).toBe("2026-03-01T12:00:00.000Z");
    expect(ld.dateModified).toBe("2026-03-02T12:00:00.000Z");
    expect(ld.author).toMatchObject({ "@type": "Organization", name: COMPANY_NAME });
    expect(ld.publisher).toMatchObject({ "@type": "Organization", name: "LootBox Games Pte Ltd" });
  });
});
