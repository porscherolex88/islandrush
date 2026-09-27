import { notFound } from "next/navigation";
import { formatDate } from "@/lib/time";
import { getContentPage } from "@/server/queries/public";
import { Container, Prose } from "./marketing";

export async function ContentPage({ slug }: { slug: string }) {
  const page = await getContentPage(slug);
  if (!page) notFound();
  return (
    <Container className="max-w-2xl py-12">
      <h1 className="text-4xl font-bold">{page.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {formatDate(page.updatedAt)}</p>
      <div className="mt-8">
        <Prose text={page.body} />
      </div>
    </Container>
  );
}

export async function contentMetadata(slug: string, fallback: string) {
  const page = await getContentPage(slug);
  return { title: page?.title ?? fallback };
}
