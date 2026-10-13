import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Pill } from "@/components/shared/status-badge";

export type EarnWay = { href: string; icon: LucideIcon; title: string; description: string; done?: boolean };

/** Other places to pick up rewards today, each marked Ready or Done. */
export function EarnMore({ ways }: { ways: EarnWay[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <div className="relative flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold">More ways to earn</h2>
          <p className="text-sm text-muted-foreground">Fresh rewards every day</p>
        </div>
        <Image src="/illustrations/3d/gift.webp" alt="" width={56} height={72} className="-my-2 h-16 w-auto rotate-6 drop-shadow-[0_8px_10px_oklch(0.24_0.05_228/0.25)]" />
      </div>
      <ul className="divide-y">
        {ways.map(({ href, icon: Icon, title, description, done }) => (
          <li key={title}>
            <Link
              href={href}
              className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{title}</span>
                  {done !== undefined &&
                    (done ? (
                      <Pill>
                        <Check className="size-3" aria-hidden /> Done
                      </Pill>
                    ) : (
                      <Pill tone="brand">Ready</Pill>
                    ))}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
