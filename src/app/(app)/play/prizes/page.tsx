import { Puzzle, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { PuzzleCard, UpcomingPrize } from "@/components/app/adventure/prizes";
import { ART } from "@/components/app/art";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { requireUser } from "@/lib/auth/session";
import { getAdventureState } from "@/server/services/adventure";
import { getAllFlags } from "@/server/services/config";

export const metadata: Metadata = { title: "Prizes" };

export default async function PrizesPage() {
  const user = await requireUser();
  const [s, flags] = await Promise.all([getAdventureState(user.id), getAllFlags()]);
  const complete = s.puzzles.filter((p) => p.complete).length;
  const enabled = flags.prize_wheel !== false;
  const current = s.puzzles.find((p) => !p.complete);
  const isFeatured = (p: (typeof s.puzzles)[number]) => p.complete || p.piecesHave > 0 || p.id === current?.id;
  const featured = s.puzzles.filter(isFeatured);
  const upcoming = s.puzzles.filter((p) => !isFeatured(p));

  return (
    <div>
      <InnerPageHeader title="Prizes" subtitle={`${complete}/${s.puzzles.length} puzzles complete`} />
      <Section>
        <div className="relative isolate flex items-center gap-4 overflow-hidden rounded-3xl bg-ocean-deep p-4 text-white">
          <Image src={ART.bigBox} alt="" width={88} height={88} className="size-22 shrink-0 object-contain drop-shadow-lg" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-200">Puzzle pieces</p>
            <p className="font-heading text-3xl leading-tight font-extrabold tabular">{s.totalPieces}</p>
            <p className="text-xs leading-snug text-white/75">Each map&apos;s Big Mystery Box drops 1 to 3 pieces of that level&apos;s prize. Complete the picture to unlock it.</p>
          </div>
        </div>
      </Section>
      <Section>
        {s.puzzles.length === 0 ? (
          <EmptyState icon={<Trophy className="size-10 text-primary" />} title="Prizes are on their way" description="Prize puzzles will appear here soon." />
        ) : (
          <div className="space-y-4">
            {featured.map((p) => (
              <PuzzleCard key={p.id} puzzle={p} verified={user.verificationStatus === "VERIFIED"} enabled={enabled} />
            ))}
            {upcoming.length > 0 && (
              <div className="space-y-2">
                <h2 className="font-heading text-lg font-bold">Coming up</h2>
                <ol className="space-y-2">
                  {upcoming.map((p) => (
                    <UpcomingPrize key={p.id} puzzle={p} />
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 text-xs leading-snug text-muted-foreground">
          <Puzzle className="mt-0.5 size-4 shrink-0" aria-hidden />
          A puzzle is complete when it has every piece and its map is finished. The Final Prize Unlock result is decided securely on our servers.
        </p>
      </Section>
    </div>
  );
}
