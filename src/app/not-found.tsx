import { Compass, LifeBuoy, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ART } from "@/components/app/art";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Page not found" };

const digit = "bg-[linear-gradient(180deg,oklch(0.82_0.15_80),oklch(0.62_0.16_55))] bg-clip-text font-heading text-[7rem] leading-none font-extrabold text-transparent tabular sm:text-[8.5rem]";

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[linear-gradient(180deg,oklch(0.965_0.05_78),oklch(0.99_0.006_85)_55%)] px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <span aria-hidden className="absolute -top-32 left-1/2 -z-10 size-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.9_0.12_80/0.55),transparent_65%)]" />
      <span aria-hidden className="absolute right-[-6rem] bottom-[-6rem] -z-10 size-72 rounded-full bg-[radial-gradient(circle,oklch(0.9_0.06_210/0.5),transparent_65%)]" />

      <div className="mx-auto w-full max-w-md">
        <Logo />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-8 text-center">
        <p className="flex items-center justify-center gap-0.5 sm:gap-1" aria-label="404">
          <span aria-hidden className={digit}>4</span>
          <span aria-hidden className="relative grid size-[5.5rem] place-items-center rounded-full border-4 border-amber-300 bg-card sm:size-[6.75rem]">
            <span className="absolute inset-2 rounded-full border-2 border-dashed border-amber-200" />
            <Compass className="size-10 animate-[spin_14s_linear_infinite] text-amber-600 sm:size-12" strokeWidth={1.75} />
          </span>
          <span aria-hidden className={digit}>4</span>
        </p>

        <div className="relative mt-6 w-full overflow-hidden rounded-2xl border border-amber-200/70">
          <Image src={ART.island} alt="" width={900} height={600} priority className="aspect-[16/9] w-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgb(6_30_40/0.55),transparent_55%)]" />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-amber-900">
            <MapPin className="size-3.5" aria-hidden />
            Uncharted waters
          </span>
        </div>

        <h1 className="mt-7 font-heading text-2xl leading-tight font-extrabold text-balance sm:text-3xl">This spot isn&apos;t on the map</h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
          The page you&apos;re looking for has drifted away or never existed. Let&apos;s get you back to shore.
        </p>

        <div className="mt-7 grid w-full gap-2.5">
          <Link href="/" className={cn(buttonVariants({ variant: "gold", size: "pill" }), "w-full")}>
            Back to home
          </Link>
          <Link href="/help" className={cn(buttonVariants({ variant: "outline", size: "pill" }), "w-full")}>
            <LifeBuoy aria-hidden />
            Visit the help centre
          </Link>
        </div>
      </div>
    </main>
  );
}
