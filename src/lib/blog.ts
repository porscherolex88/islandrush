import type { Metadata } from "next";
import { COMPANY_NAME } from "@/lib/company";
import { absoluteUrl } from "@/lib/site";

export type BlogPostSeoInput = {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  publishedAt: Date | string | null;
  updatedAt: Date | string;
};

export function blogPostPath(slug: string): string {
  return `/blog/${slug}`;
}

export function blogCanonicalUrl(slug: string): string {
  return absoluteUrl(blogPostPath(slug));
}

export function blogMetaDescription(post: Pick<BlogPostSeoInput, "seoDescription" | "excerpt" | "title">): string {
  return (post.seoDescription || post.excerpt || post.title).trim();
}

export function blogPageTitle(post: Pick<BlogPostSeoInput, "seoTitle" | "title">): string {
  return (post.seoTitle || post.title).trim();
}

export function blogPostMetadata(post: BlogPostSeoInput): Metadata {
  const title = blogPageTitle(post);
  const description = blogMetaDescription(post);
  const canonical = blogCanonicalUrl(post.slug);
  const images = post.coverImageUrl
    ? [{ url: post.coverImageUrl, alt: post.coverImageAlt || post.title }]
    : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: "LootBox",
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
      images,
    },
    twitter: {
      card: post.coverImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

/** Schema.org Article JSON-LD for a published blog post. */
export function blogArticleJsonLd(post: BlogPostSeoInput): Record<string, unknown> {
  const url = blogCanonicalUrl(post.slug);
  const description = blogMetaDescription(post);
  const published = post.publishedAt ? new Date(post.publishedAt).toISOString() : new Date(post.updatedAt).toISOString();
  const modified = new Date(post.updatedAt).toISOString();
  const org = {
    "@type": "Organization",
    name: COMPANY_NAME,
    url: absoluteUrl("/"),
  };
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: blogPageTitle(post),
    description,
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author: org,
    publisher: org,
  };
  if (post.coverImageUrl) {
    data.image = [post.coverImageUrl];
  }
  return data;
}
