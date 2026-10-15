import { notFound } from "next/navigation";
import { COMPANY_NAME } from "@/lib/company";
import { getLicenceDisplay } from "@/lib/compliance/licence";
import { formatDate } from "@/lib/time";
import { getContentPage } from "@/server/queries/public";
import { Container, PageHero, Prose } from "./marketing";

function legalAppendix(slug: string): string | null {
  if (slug !== "terms" && slug !== "privacy") return null;
  const licence = getLicenceDisplay();
  const lines = [`\n\nOperated by ${COMPANY_NAME}.`];
  if (licence) {
    lines.push(
      `Licensed entity: ${licence.licensedEntity ?? COMPANY_NAME}.`,
      `Licence number: ${licence.licenceNumber}.`,
    );
  }
  return lines.join(" ");
}

export async function ContentPage({ slug }: { slug: string }) {
  const page = await getContentPage(slug);
  if (!page) notFound();
  const appendix = legalAppendix(slug);
  const body = appendix ? `${page.body}${appendix}` : page.body;
  return (
    <>
      <PageHero eyebrow="LootBox" title={page.title} description={`Last updated ${formatDate(page.updatedAt)}`} />
      <Container className="max-w-3xl py-10 sm:py-14">
        <article className="rounded-3xl border bg-card p-5 sm:p-10">
          <Prose text={body} />
        </article>
      </Container>
    </>
  );
}

export async function contentMetadata(slug: string, fallback: string) {
  const page = await getContentPage(slug);
  return { title: page?.title ?? fallback };
}
