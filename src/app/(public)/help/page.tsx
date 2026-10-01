import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero } from "@/components/public/marketing";
import { publishedHelpArticles } from "@/server/queries/public";

export const metadata: Metadata = { title: "Help centre", description: "Guides for deposits, withdrawals, games and your account." };
export const revalidate = 300;

export default async function HelpPage() {
  const articles = await publishedHelpArticles();
  const groups = new Map<string, typeof articles>();
  for (const a of articles) groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
  return (
    <>
      <PageHero eyebrow="Help centre" title="How can we help?" description="Step-by-step guides for the most common questions." />
      <Container className="max-w-4xl py-12">
        {groups.size === 0 && <p className="text-center text-muted-foreground">No articles published yet.</p>}
        <div className="grid gap-8 md:grid-cols-2">
          {[...groups].map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-3 text-lg font-bold">{category}</h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {items.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/help/${a.slug}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-surface">
                      <div className="flex-1">
                        <p className="font-semibold">{a.title}</p>
                        {a.summary && <p className="text-sm text-muted-foreground">{a.summary}</p>}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-12 rounded-3xl bg-surface p-6 text-center">
          <p className="font-semibold">Can&apos;t find what you need?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href="/contact" className="font-semibold text-primary underline">
              Contact our support team
            </Link>{" "}
            and we&apos;ll get back to you.
          </p>
        </div>
      </Container>
    </>
  );
}
