import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, PageHero, Prose } from "@/components/public/marketing";
import { formatDate } from "@/lib/time";
import { getHelpArticle } from "@/server/queries/public";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/help/[slug]">): Promise<Metadata> {
  const article = await getHelpArticle((await params).slug);
  return article ? { title: article.title, description: article.summary } : { title: "Help centre" };
}

export default async function HelpArticlePage({ params }: PageProps<"/help/[slug]">) {
  const article = await getHelpArticle((await params).slug);
  if (!article) notFound();
  return (
    <>
      <PageHero eyebrow={article.category} title={article.title} description={`Updated ${formatDate(article.updatedAt)}`}>
        <Link href="/help" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-white/80 hover:text-white">
          <ArrowLeft className="size-4" aria-hidden /> Help centre
        </Link>
      </PageHero>
    <Container className="max-w-3xl py-10 sm:py-14">
      <article className="rounded-3xl border bg-card p-5 sm:p-10">
        <Prose text={article.body} />
      </article>
      <div className="mt-6 rounded-3xl bg-surface p-5 text-sm">
        Need more help?{" "}
        <Link href="/contact" className="font-semibold text-primary underline">
          Contact support
        </Link>
        .
      </div>
    </Container>
    </>
  );
}
