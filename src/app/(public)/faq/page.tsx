import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero } from "@/components/public/marketing";
import { publishedFaqs } from "@/server/queries/public";

export const metadata: Metadata = { title: "FAQ", description: "Answers to common questions about LootBox." };
export const revalidate = 300;

export default async function FaqPage() {
  const rows = await publishedFaqs();
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" description="Quick answers about Credits, rewards, withdrawals and the adventure." art="/illustrations/3d/puzzle.webp" />
      <Container className="max-w-3xl py-10 sm:py-14">
        {groups.size === 0 && <p className="text-center text-muted-foreground">No questions published yet.</p>}
        <div className="space-y-10">
          {[...groups].map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-3 text-xl font-bold">{category}</h2>
              <div className="divide-y rounded-3xl border bg-card">
                {items.map((f) => (
                  <details key={f.id} className="group px-4 py-1 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                      {f.question}
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="pb-4 text-sm leading-6 whitespace-pre-line text-muted-foreground">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Still stuck? Visit the{" "}
          <Link href="/help" className="font-semibold text-primary underline">
            Help centre
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="font-semibold text-primary underline">
            contact us
          </Link>
          .
        </p>
      </Container>
    </>
  );
}
