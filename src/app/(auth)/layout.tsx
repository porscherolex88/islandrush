import Image from "next/image";
import { BodyTheme } from "@/components/shared/body-theme";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="theme-coinbase grid min-h-dvh bg-background text-foreground lg:grid-cols-2">
      <BodyTheme className="theme-coinbase" />
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="relative mt-5 h-28 overflow-hidden rounded-3xl text-white sm:h-36 lg:hidden">
          <Image src="/illustrations/island-map.webp" alt="" fill priority sizes="100vw" className="object-cover" />
          <div aria-hidden className="art-scrim-b absolute inset-0" />
          <p className="absolute inset-x-4 bottom-3 font-heading text-lg leading-tight font-bold sm:text-xl">Every day brings a new adventure.</p>
        </div>
        <main className="flex flex-1 items-center justify-center py-8 lg:py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <Image src="/illustrations/island-map.webp" alt="" fill priority sizes="50vw" className="object-cover" />
        <div aria-hidden className="art-scrim-b absolute inset-0" />
        <p className="relative text-sm font-bold text-amber-200">Explore, Discover, Collect, Unlock</p>
        <p className="relative mt-2 font-heading text-4xl leading-tight font-bold">Every day brings a new adventure.</p>
        <p className="relative mt-3 max-w-md text-white/85">Open Mystery Boxes for Loot, reach every checkpoint, complete prize puzzles and move up ten Adventure Levels.</p>
      </aside>
    </div>
  );
}
