import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Primary marketing CTA: gold gradient and fully rounded corners. */
export function LandingButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button variant="gold" size="xl" className={cn("rounded-full", className)} {...props} />;
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="border-b bg-[radial-gradient(ellipse_at_top,var(--brand-soft),transparent_70%)]">
      <Container className="py-14 text-center sm:py-20">
        {eyebrow && <p className="mb-3 text-sm font-semibold text-primary">{eyebrow}</p>}
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {description && <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  );
}

export function SectionBlock({ title, description, children, className }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("py-14 sm:py-20", className)}>
      <Container>
        {(title || description) && (
          <div className="mx-auto mb-10 max-w-2xl text-center">
            {title && <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>}
            {description && <p className="mt-3 text-muted-foreground">{description}</p>}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}

export function FeatureCard({ icon: Icon, emoji, title, children, className }: { icon?: LucideIcon; emoji?: string; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border bg-card p-6", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-brand-soft text-2xl text-primary">
        {Icon ? <Icon className="size-6" aria-hidden /> : <span aria-hidden>{emoji}</span>}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="rounded-3xl border bg-card p-6">
          <span className="grid size-9 place-items-center rounded-full bg-primary font-heading font-bold text-primary-foreground">{i + 1}</span>
          <h3 className="mt-4 font-bold">{s.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function CtaBand({ title = "Your island is waiting", description = "Create a free account and claim your first daily spin today." }: { title?: string; description?: string }) {
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] px-6 py-12 text-center text-white sm:px-12">
          <Image src="/illustrations/island-map.webp" alt="" fill sizes="(min-width: 1024px) 1100px, 100vw" className="object-cover" />
          <div aria-hidden className="absolute inset-0 bg-[oklch(0.25_0.06_222/0.78)]" />
          <h2 className="relative text-3xl font-bold sm:text-4xl">{title}</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/85">{description}</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="xl" variant="gold">
              <Link href="/register">Get started free</Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[15px] leading-7 text-foreground/90">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^(-|\d+\.)\s/.test(l.trim()))) {
          const ordered = /^\d+\./.test(lines[0].trim());
          const items = lines.map((l) => l.trim().replace(/^(-|\d+\.)\s/, ""));
          const List = ordered ? "ol" : "ul";
          return (
            <List key={i} className={cn("space-y-1 pl-5", ordered ? "list-decimal" : "list-disc")}>
              {items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </List>
          );
        }
        if (lines.length > 1 && !/^(-|\d+\.)\s/.test(lines[0]) && lines.slice(1).every((l) => /^(-|\d+\.)\s/.test(l.trim()))) {
          return (
            <div key={i}>
              <p>{lines[0]}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {lines.slice(1).map((l, j) => (
                  <li key={j}>{l.trim().replace(/^(-|\d+\.)\s/, "")}</li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {b}
          </p>
        );
      })}
    </div>
  );
}
