import type { Metadata } from "next";
import Image from "next/image";
import { Container, CtaBand, PageHero, SectionBlock } from "@/components/public/marketing";
import { creditsToCashMinor, formatCredits, toMinor, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { publicGameFacts } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Games",
  description: "Mystery Boxes, Loot, checkpoints across 10 islands, Big Boxes, Puzzle pieces and prizes.",
};
export const revalidate = 300;

export default async function GamesPage() {
  const fiat = await getFiatDisplay();
  const { boxes, conversion } = await publicGameFacts();
  const rateCash = toMinor(conversion.cash);
  const rateCredits = BigInt(conversion.credits);
  return (
    <>
      <PageHero
        eyebrow="Games"
        title="One adventure, ten islands"
        description="Open Mystery Boxes for Loot, unlock checkpoints, open the Big Box for Puzzle pieces, finish the puzzle and spin the prize wheel. Results are always decided by our servers."
        art="/illustrations/3d/map-scroll.webp"
      />

      <SectionBlock>
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
          <div>
            <Image src="/illustrations/3d/crate.webp" alt="" width={72} height={72} className="size-18 object-contain drop-shadow-lg" />
            <p className="mt-4 text-xs font-bold text-primary">Step 1</p>
            <h2 className="mt-1 text-3xl font-bold sm:text-4xl">Mystery Box</h2>
            <p className="mt-3 text-muted-foreground">
              Each island has its own Mystery Box. Every opening gives Loot for that island plus a lucky drop: free Credits, a Cash reward or a Free unlock that lets you open the same box again for free. Every box shows its prizes before you open it.
            </p>
          </div>
          <div className="grid gap-3">
            {boxes.map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-3 rounded-3xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{b.name}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular">{formatCredits(b.priceCredits)} Credits</p>
                  <p className="text-xs text-muted-foreground tabular">{formatCash(creditsToCashMinor(BigInt(b.priceCredits), rateCash, rateCredits), { currency: fiat })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionBlock>

      <section className="bg-surface py-12 sm:py-20">
        <Container className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="relative order-2 aspect-[4/3] overflow-hidden rounded-3xl lg:order-1">
            <Image src="/illustrations/adventure/map-2.webp" alt="Illustrated island trail with checkpoints" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs font-bold text-primary">Step 2</p>
            <h2 className="mt-1 text-3xl font-bold sm:text-4xl">Island trails and checkpoints</h2>
            <p className="mt-3 text-muted-foreground">
              Loot fills the chest on each trail stop. Collect enough Loot to unlock the next checkpoint in order. Reach the final checkpoint to open that island&apos;s Big Box.
            </p>
          </div>
        </Container>
      </section>

      <SectionBlock>
        <div className="mx-auto max-w-2xl text-center">
          <Image src="/illustrations/3d/big-box.webp" alt="" width={96} height={96} className="mx-auto size-24 object-contain drop-shadow-lg" />
          <p className="mt-4 text-xs font-bold text-primary">Step 3</p>
          <h2 className="mt-1 text-3xl font-bold sm:text-4xl">Big Box, Puzzle pieces and prizes</h2>
          <p className="mt-3 text-muted-foreground">
            Each island&apos;s Big Box gives Puzzle pieces for that island only. Finish the puzzle to spin the prize wheel. Prizes are subject to availability and our Terms.
          </p>
        </div>
      </SectionBlock>
      <CtaBand title="Ready to explore?" />
    </>
  );
}
