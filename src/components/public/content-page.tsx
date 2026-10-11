import { notFound } from "next/navigation";
import { formatDate } from "@/lib/time";
import { getContentPage } from "@/server/queries/public";
import { Container, PageHero, Prose } from "./marketing";

export async function ContentPage({ slug }: { slug: string }) {
  const page = await getContentPage(slug);
  if (!page) notFound();
  return (
    <>
      <PageHero eyebrow="LootBox" title={page.title} description={`Last updated ${formatDate(page.updatedAt)}`} />
      <Container className="max-w-3xl py-10 sm:py-14">
        <article className="rounded-3xl border bg-card p-5 sm:p-10">
          <Prose text={page.body} />
        </article>
      </Container>
    </>
  );
}

export async function contentMetadata(slug: string, fallback: string) {
  const page = await getContentPage(slug);
  return { title: page?.title ?? fallback };
}
