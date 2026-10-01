import type { Metadata } from "next";
import { Container, CtaBand, PageHero, SectionBlock } from "@/components/public/marketing";
import { creditsToCashMinor, formatCredits, toMinor, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { publicGameFacts } from "@/server/queries/public";

export const metadata: Metadata = { title: "Games", description: "Mystery Box, Mystery Map and the Vault." };
export const revalidate = 300;

export default async function GamesPage() {
  const fiat = await getFiatDisplay();
  const { boxes, conversion } = await publicGameFacts();
  const rateCash = toMinor(conversion.cash);
  const rateCredits = BigInt(conversion.credits);
  return (
    <>
      <PageHero eyebrow="Games" title="Three games, one island" description="Everything you find in one game can help you in another. Results are always decided by our servers." />

      <SectionBlock>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-5xl" aria-hidden>
              🎁
            </p>
            <h2 className="mt-3 text-3xl font-bold">Mystery Box</h2>
            <p className="mt-3 text-muted-foreground">
              Choose a box type, then pick one of nine boxes on the grid. Your reward is revealed instantly: Credits, collection items, fragments, keys or Cash rewards. Odds are published on every box.
            </p>
          </div>
          <div className="grid gap-3">
            {boxes.map((b) => (
              <div key={b.name} className="flex items-center justify-between rounded-2xl border bg-card p-4">
                <div>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-sm text-muted-foreground">{b.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular">{formatCredits(b.priceCredits)} Credits</p>
                  <p className="text-xs text-muted-foreground tabular">{formatCash(creditsToCashMinor(BigInt(b.priceCredits), rateCash, rateCredits), { currency: fiat })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionBlock>

      <section className="bg-surface py-14 sm:py-20">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 grid grid-cols-4 gap-2 lg:order-1">
            {["🏖️", "🌴", "❔", "❔", "🐚", "⛵", "❔", "🔒", "🌿", "❔", "🗿", "🔒", "❔", "🔒", "🔒", "🏛️"].map((e, i) => (
              <div key={i} className="grid aspect-square place-items-center rounded-xl border bg-card text-2xl">
                {e}
              </div>
            ))}
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-5xl" aria-hidden>
              🗺️
            </p>
            <h2 className="mt-3 text-3xl font-bold">Mystery Map</h2>
            <p className="mt-3 text-muted-foreground">
              Explore Lost Island one tile at a time. Each discovery reveals something, and discovering enough tiles unlocks the next area. Special Areas like the Temple need keys, items and collection progress to enter.
              You get free discoveries every day.
            </p>
          </div>
        </Container>
      </section>

      <SectionBlock>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-5xl" aria-hidden>
            🏛️
          </p>
          <h2 className="mt-3 text-3xl font-bold">The Vault</h2>
          <p className="mt-3 text-muted-foreground">
            Vaults hold the island&apos;s biggest rewards. Each one lists exactly what it needs, such as a Vault Key, eight Vault Seal Fragments or a completed collection. Meet the requirements and the door is yours to open.
          </p>
        </div>
      </SectionBlock>
      <CtaBand title="Ready to explore?" />
    </>
  );
}
