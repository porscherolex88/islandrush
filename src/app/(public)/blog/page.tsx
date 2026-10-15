import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero } from "@/components/public/marketing";
import { absoluteUrl } from "@/lib/site";
import { formatDate } from "@/lib/time";
import { publishedBlogPosts } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Blog",
  description: "News, guides and updates from LootBox.",
  alternates: { canonical: absoluteUrl("/blog") },
  openGraph: {
    type: "website",
    url: absoluteUrl("/blog"),
    title: "Blog",
    description: "News, guides and updates from LootBox.",
    siteName: "LootBox",
  },
  robots: { index: true, follow: true },
};

export const revalidate = 300;

export default async function BlogIndexPage() {
  const posts = await publishedBlogPosts();
  return (
    <>
      <PageHero eyebrow="Blog" title="News and guides" description="Updates from the LootBox team. Tips, product notes and how-to guides." />
      <Container className="max-w-3xl py-10 sm:py-14">
        {posts.length === 0 ? (
          <p className="text-center text-muted-foreground">No posts published yet. Check back soon.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="flex flex-col gap-3 p-5 transition-colors hover:bg-surface sm:flex-row sm:items-start sm:gap-5">
                  {post.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-provided absolute cover URLs
                    <img
                      src={post.coverImageUrl}
                      alt={post.coverImageAlt || post.title}
                      className="aspect-[16/10] w-full shrink-0 rounded-2xl object-cover sm:h-24 sm:w-40 sm:aspect-auto"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">{post.publishedAt ? formatDate(post.publishedAt) : null}</p>
                    <h2 className="mt-1 text-lg font-bold tracking-tight">{post.title}</h2>
                    {post.excerpt ? <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
