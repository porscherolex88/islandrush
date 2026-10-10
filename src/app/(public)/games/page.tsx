import type { Metadata } from "next";
import Image from "next/image";
import { Container, CtaBand, PageHero, SectionBlock } from "@/components/public/marketing";
import { creditsToCashMinor, formatCredits, toMinor, formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { publicGameFacts } from "@/server/queries/public";

export const metadata: Metadata = { title: "Games", description: "Mystery Boxes, Mystery Maps, puzzles and prizes across ten Adventure Levels." };
export const revalidate = 300;

export default async function GamesPage() {
  const fiat = await getFiatDisplay();
  const { boxes, conversion } = await publicGameFacts();
  const rateCash = toMinor(conversion.cash);
  const rateCredits = BigInt(conversion.credits);
  return (
    <>
      <PageHero eyebrow="Games" title="One adventure, ten levels" description="Box, Loot, Map, Checkpoints, Big Box, Puzzle, Prize, then the next level. Results are always decided by our servers." />

      <SectionBlock>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Image src="/illustrations/crate.webp" alt="" width={72} height={72} className="size-18 rounded-2xl object-cover" />
            <h2 className="mt-3 text-3xl font-bold">Mystery Box</h2>
            <p className="mt-3 text-muted-foreground">
              Each Adventure Level has its own Mystery Box. Every opening gives Loot for that level&apos;s map plus a bonus reward such as Credits or a Cash reward. Prizes and odds are published on every box.
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
          <div className="relative order-2 aspect-[4/3] overflow-hidden rounded-3xl border lg:order-1">
            <Image src="/illustrations/adventure/map-2.webp" alt="Illustrated adventure map with checkpoints" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl font-bold">Mystery Map</h2>
            <p className="mt-3 text-muted-foreground">
              Collect enough Loot to unlock a map, then move from checkpoint to checkpoint along its route. Loot is never used up, so every piece keeps counting toward the next checkpoint and the final destination.
            </p>
          </div>
        </Container>
      </section>

      <SectionBlock>
        <div className="mx-auto max-w-2xl text-center">
          <Image src="/illustrations/adventure/big-box.webp" alt="" width={96} height={96} className="mx-auto size-24 object-contain" />
          <h2 className="mt-3 text-3xl font-bold">Big Mystery Box, Puzzles and Prizes</h2>
          <p className="mt-3 text-muted-foreground">
            The final checkpoint of every map holds a Big Mystery Box with one to three puzzle pieces. Complete that level&apos;s prize puzzle to reach its prize unlock. Higher Adventure Levels have higher prize tiers.
          </p>
        </div>
      </SectionBlock>
      <CtaBand title="Ready to explore?" />
    </>
  );
}
