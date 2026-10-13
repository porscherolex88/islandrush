import { BarChart3, Check, ChevronRight, Gem, Gift, Lock, Map as MapIcon, Package, Puzzle, Store, Tag, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LootToken } from "@/components/app/adventure/loot";
import { mapArt, Token } from "@/components/app/art";
import { ListCard, SegmentedNav, StatTile } from "@/components/app/kit";
import { Section } from "@/components/app/mobile-header";
import { CollectionsHeader } from "@/components/app/root-page-header";
import { EmptyState } from "@/components/shared/states";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { rarityOf } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { getCollection, type CollectionData } from "@/server/queries/collection";

export const metadata: Metadata = { title: "Collections" };

const VIEWS = [
  { key: "all", label: "All" },
  { key: "sellable", label: "Sellable" },
  { key: "keepsakes", label: "Keepsakes" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

function SellableBadge() {
  return <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">Sellable</span>;
}

function KeepsakeBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      <Lock className="size-2.5" aria-hidden /> Not sellable
    </span>
  );
}

function SubHeading({ icon: Icon, title, meta }: { icon: typeof Gem; title: string; meta?: string }) {
  return (
    <div className="mt-4 mb-2 flex items-center justify-between gap-2 first:mt-0">
      <h3 className="flex items-center gap-1.5 text-sm font-bold">
        <Icon className="size-4 text-primary" aria-hidden /> {title}
      </h3>
      {meta && <span className="text-xs font-semibold text-muted-foreground tabular">{meta}</span>}
    </div>
  );
}

function LootAlbum({ data }: { data: CollectionData }) {
  return (
    <div className="space-y-2">
      {data.lootMaps.map((m) => {
        const found = m.items.filter((i) => i.collected > 0).length;
        return (
          <ListCard key={m.id} className="p-3">
            <div className="flex items-center gap-3">
              <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-ocean-deep">
                <Image src={mapArt(m.level, m.artwork)} alt="" fill sizes="44px" className={cn("object-cover", m.state === "locked" && "opacity-40 grayscale")} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{m.name}</p>
                <p className="text-xs text-muted-foreground tabular">Adventure Level {m.level}</p>
              </div>
              <span className={cn("shrink-0 text-xs font-bold tabular", found === m.items.length && found > 0 ? "text-success" : "text-muted-foreground")}>
                {found}/{m.items.length} found
              </span>
            </div>
            {m.items.length > 0 && (
              <ul className="mt-3 space-y-2">
                {m.items.map((it) => {
                  const has = it.collected > 0;
                  return (
                    <li key={it.id} className={cn("flex min-w-0 items-center gap-2.5 rounded-2xl p-2", has ? "bg-surface" : "bg-muted/40")}>
                      <LootToken icon={it.icon} rarity={it.rarity} collected={has} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-semibold", !has && "text-muted-foreground")}>{has ? it.name : "Not found yet"}</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular">
                          {has ? <>You own {it.owned.toLocaleString("en-MY")}</> : "Open this map's Mystery Box"}
                          {it.listed > 0 && <span className="font-semibold text-primary">· {it.listed} listed</span>}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </ListCard>
        );
      })}
      {data.lockedMapCount > 0 && (
        <p className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> {data.lockedMapCount} more maps unlock as you explore
        </p>
      )}
      <p className="px-1 text-xs text-muted-foreground">Selling Loot never undoes your map progress: checkpoints count every piece you have ever found.</p>
    </div>
  );
}

function SellableSection({ data }: { data: CollectionData }) {
  return (
    <Section
      id="sellable"
      className="scroll-mt-20"
      title={
        <>
          <Tag className="size-5 text-success" aria-hidden /> Sellable
        </>
      }
      action={
        <Link href="/market/sell" className="flex h-11 items-center text-sm font-semibold text-primary">
          Sell
        </Link>
      }
    >
      <p className="-mt-1 mb-3 text-sm text-muted-foreground">Items you can keep, or sell on the Market for Credits.</p>

      <SubHeading icon={Gem} title="Adventure Loot" />
      <LootAlbum data={data} />

      <SubHeading icon={Package} title="Items" meta={data.otherItems.length ? `${data.otherItems.length} kinds` : undefined} />
      {data.otherItems.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-4 text-center text-sm text-muted-foreground">Bonus items from boxes and spins land here.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {data.otherItems.map((i) => {
            const r = rarityOf(i.rarity);
            return (
              <li key={i.id} className="flex flex-col gap-2 rounded-3xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <Token icon={i.icon} rarity={i.rarity} quantity={i.quantity} />
                  <SellableBadge />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{i.name}</p>
                  <p className="text-xs">
                    <span className={cn("font-semibold", r.text)}>{r.label}</span>
                    <span className="text-muted-foreground tabular"> · ×{i.quantity}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data.listings.length > 0 && (
        <Link href="/market/sell" className="mt-3 flex min-h-12 items-center gap-2 rounded-3xl border bg-card px-4 text-sm font-semibold hover:bg-surface">
          <Store className="size-4 text-primary" aria-hidden />
          {data.counts.listed} on the Market
          <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}
    </Section>
  );
}

function KeepsakesSection({ data }: { data: CollectionData }) {
  return (
    <Section
      id="keepsakes"
      className="scroll-mt-20"
      title={
        <>
          <Lock className="size-5 text-gold" aria-hidden /> Keepsakes
        </>
      }
    >
      <p className="-mt-1 mb-3 text-sm text-muted-foreground">Progress you earn and keep. These can&apos;t be sold or traded.</p>

      <SubHeading icon={Puzzle} title="Puzzle pieces" meta={`${data.totalPieces} ${data.totalPieces === 1 ? "piece" : "pieces"}`} />
      {data.puzzles.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-4 text-center text-sm text-muted-foreground">Finish a map to open its Big Mystery Box and find puzzle pieces.</p>
      ) : (
        <ul className="space-y-2">
          {data.puzzles.map((p) => {
            const have = Math.min(p.piecesHave, p.piecesRequired);
            return (
              <li key={p.id}>
                <Link href="/play/prizes" className="flex items-center gap-3 rounded-3xl border bg-card p-3 hover:bg-surface">
                  <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gold-soft text-gold-foreground">
                    {p.image ? <Image src={p.image} alt="" fill sizes="48px" unoptimized={/^https?:/.test(p.image)} className="object-cover" /> : <Puzzle className="size-6" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <KeepsakeBadge />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">Prize: {p.prize.name}</p>
                    <div className="mt-1.5 flex gap-0.5" aria-label={`${have} of ${p.piecesRequired} pieces`}>
                      {Array.from({ length: p.piecesRequired }, (_, i) => (
                        <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < have ? (p.complete ? "bg-success" : "bg-amber-500") : "bg-muted")} />
                      ))}
                    </div>
                  </div>
                  <span className={cn("text-sm font-bold tabular", p.complete && "text-success")}>
                    {have}/{p.piecesRequired}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <SubHeading icon={Gift} title="Prizes unlocked" meta={data.unlocks.length ? String(data.unlocks.length) : undefined} />
      {data.unlocks.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-4 text-center text-sm text-muted-foreground">Complete a prize puzzle to unlock its prize.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {data.unlocks.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 rounded-3xl border border-gold/40 bg-gold-soft/60 p-3">
              <span className="relative grid size-12 place-items-center overflow-hidden rounded-xl bg-white text-gold-foreground">
                {u.image ? <Image src={u.image} alt="" fill sizes="48px" unoptimized={/^https?:/.test(u.image)} className="object-cover" /> : <Gift className="size-6" aria-hidden />}
              </span>
              <p className="line-clamp-2 text-sm leading-tight font-bold">{u.title}</p>
              <p className="mt-auto text-xs text-gold-foreground tabular">Adventure Level {u.level}</p>
            </li>
          ))}
        </ul>
      )}

      <SubHeading icon={Trophy} title="Badges" meta={`${data.earnedBadges} / ${data.badges.length}`} />
      <ul className="grid grid-cols-2 gap-2">
        {[...data.badges]
          .sort((a, b) => Number(Boolean(b.earnedAt)) - Number(Boolean(a.earnedAt)) || b.current / Math.max(1, b.threshold) - a.current / Math.max(1, a.threshold))
          .map((a) => {
            const pct = Math.round((Math.min(a.current, a.threshold) / Math.max(1, a.threshold)) * 100);
            return (
              <li key={a.id} className={cn("flex flex-col gap-2 rounded-3xl border p-3", a.earnedAt ? "border-gold/40 bg-gold-soft/70" : "bg-card")}>
                <Token icon={a.badgeIcon} rarity={a.earnedAt ? "LEGENDARY" : "COMMON"} owned={Boolean(a.earnedAt) || a.current > 0} size="md" />
                <div>
                  <p className="text-sm leading-tight font-bold">{a.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
                </div>
                {a.earnedAt ? (
                  <p className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-gold-foreground">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden /> Earned
                  </p>
                ) : (
                  <div className="mt-auto">
                    <Progress value={pct} className="h-1.5" indicatorClassName="bg-amber-500" aria-label={`${a.name} progress`} />
                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground tabular">
                      {Math.min(a.current, a.threshold)} / {a.threshold}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
      </ul>

      <SubHeading icon={MapIcon} title="Maps completed" meta={String(data.completedMaps.length)} />
      {data.completedMaps.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-4 text-center text-sm text-muted-foreground">Reach the final checkpoint of a map to earn its stamp.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {data.completedMaps.map((m) => (
            <li key={m.id} className="relative isolate aspect-square overflow-hidden rounded-3xl text-white">
              <Image src={mapArt(m.level, m.artwork)} alt="" fill sizes="140px" className="-z-10 object-cover" />
              <span aria-hidden className="art-scrim-b absolute inset-0 -z-10" />
              <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-success">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
              <span className="absolute inset-x-2 bottom-2 truncate text-xs font-bold">{m.name}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default async function CollectionsPage({ searchParams }: PageProps<"/collections">) {
  const user = await requireUser();
  const sp = await searchParams;
  const view: ViewKey = VIEWS.some((v) => v.key === sp.view) ? (sp.view as ViewKey) : "all";
  const data = await getCollection(user);
  const empty = data.counts.sellable === 0 && data.counts.keepsakes === 0 && data.listings.length === 0;

  return (
    <div className="pb-4">
      <CollectionsHeader sellable={data.counts.sellable} keepsakes={data.counts.keepsakes} />

      <Section className="pt-1">
        <div className="grid grid-cols-3 gap-2">
          <StatTile href="/collections?view=sellable" icon={Tag} tone="bg-success-soft text-success" value={data.counts.sellable.toLocaleString("en-MY")} label="Sellable" />
          <StatTile href="/collections?view=keepsakes" icon={Lock} tone="bg-gold-soft text-gold-foreground" value={data.counts.keepsakes.toLocaleString("en-MY")} label="Keepsakes" />
          <StatTile href="/market/sell" icon={Store} value={data.counts.listed.toLocaleString("en-MY")} label="Listed" />
        </div>
        <SegmentedNav
          className="mt-3"
          label="Collection filter"
          items={VIEWS.map((v) => ({ href: v.key === "all" ? "/collections" : `/collections?view=${v.key}`, label: v.label, active: view === v.key }))}
        />
      </Section>

      {empty && (
        <Section>
          <EmptyState
            icon={<Gem className="size-8 text-primary" />}
            title="Your collection is empty"
            description="Open a Mystery Box to find your first Loot."
            action={
              <Link href="/play" className="text-sm font-bold text-primary">
                Start playing
              </Link>
            }
          />
        </Section>
      )}

      {view !== "keepsakes" && <SellableSection data={data} />}
      {view !== "sellable" && <KeepsakesSection data={data} />}

      <Section>
        <details className="group rounded-3xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <BarChart3 className="size-4 text-primary" aria-hidden /> Your stats
            <ChevronRight className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <dl className="grid grid-cols-2 gap-2 border-t p-3">
            {data.stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-surface p-3">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="font-heading text-xl font-extrabold tabular">
                  {s.value.toLocaleString("en-MY")}
                  {s.suffix ?? ""}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </Section>
    </div>
  );
}
