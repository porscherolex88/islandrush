import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Prose } from "@/components/public/marketing";
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
    <Container className="max-w-2xl py-10">
      <Link href="/help" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Help centre
      </Link>
      <p className="mt-6 text-sm font-semibold text-primary">{article.category}</p>
      <h1 className="mt-1 text-3xl font-bold">{article.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Updated {formatDate(article.updatedAt)}</p>
      <div className="mt-8">
        <Prose text={article.body} />
      </div>
      <div className="mt-12 rounded-2xl bg-surface p-5 text-sm">
        Need more help?{" "}
        <Link href="/contact" className="font-semibold text-primary underline">
          Contact support
        </Link>
        .
      </div>
    </Container>
  );
}
