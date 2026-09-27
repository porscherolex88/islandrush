import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(160deg,oklch(0.46_0.22_285),oklch(0.32_0.16_295))] p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div aria-hidden className="absolute top-16 right-16 grid grid-cols-3 gap-3 opacity-90">
          {["🎁", "🗺️", "🏛️", "🪙", "🔑", "🏺", "💎", "🧭", "✨"].map((e, i) => (
            <span key={i} className="grid size-20 place-items-center rounded-2xl bg-white/10 text-4xl backdrop-blur" style={{ transform: `rotate(${(i % 3) * 4 - 4}deg)` }}>
              {e}
            </span>
          ))}
        </div>
        <p className="font-heading text-4xl leading-tight font-bold">Every day on Lost Island brings something new.</p>
        <p className="mt-3 max-w-md text-white/75">Open Mystery Boxes, explore the map, complete collections and unlock the Ancient Vault.</p>
      </aside>
    </div>
  );
}
