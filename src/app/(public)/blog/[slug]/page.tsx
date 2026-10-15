import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, PageHero } from "@/components/public/marketing";
import { blogArticleJsonLd, blogPostMetadata } from "@/lib/blog";
import { MarkdownProse } from "@/lib/markdown";
import { formatDate } from "@/lib/time";
import { getPublishedBlogPost } from "@/server/queries/public";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await getPublishedBlogPost((await params).slug);
  if (!post) return { title: "Blog", robots: { index: false, follow: false } };
  return blogPostMetadata(post);
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = await getPublishedBlogPost((await params).slug);
  if (!post) notFound();
  const jsonLd = blogArticleJsonLd(post);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        eyebrow="Blog"
        title={post.title}
        description={[post.publishedAt ? formatDate(post.publishedAt) : null, post.excerpt || null].filter(Boolean).join(" · ")}
      >
        <Link href="/blog" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> All posts
        </Link>
      </PageHero>
      <Container className="max-w-3xl py-10 sm:py-14">
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-provided absolute cover URLs
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt || post.title}
            className="mb-8 aspect-[2/1] w-full rounded-3xl object-cover"
          />
        ) : null}
        <article className="rounded-3xl border bg-card p-5 sm:p-10">
          <MarkdownProse text={post.body} />
        </article>
      </Container>
    </>
  );
}
