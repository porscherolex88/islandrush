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

/** Section title block used on every public page: optional eyebrow, title and supporting line. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("mb-8 max-w-2xl sm:mb-12", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className={cn("mb-2 text-xs font-bold tracking-widest uppercase", tone === "dark" ? "text-gold" : "text-primary")}>{eyebrow}</p>}
      <h2 className="text-3xl leading-[1.1] font-bold tracking-tight sm:text-5xl">{title}</h2>
      {description && <p className={cn("mt-3 text-base sm:mt-4 sm:text-lg", tone === "dark" ? "text-white/70" : "text-muted-foreground")}>{description}</p>}
    </div>
  );
}

/** Dark ocean hero for inner public pages, matching the landing page hero. */
export function PageHero({ eyebrow, title, description, art, children }: { eyebrow?: string; title: string; description?: string; art?: string; children?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-ocean-deep text-white">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_70%_at_80%_20%,oklch(0.42_0.09_210/0.9),transparent_70%),radial-gradient(ellipse_60%_60%_at_0%_100%,oklch(0.36_0.08_190/0.7),transparent_70%)]" />
      <Container className={cn("grid items-center gap-6 py-10 sm:py-16", art && "md:grid-cols-[1.4fr_1fr]")}>
        <div>
          {eyebrow && <p className="mb-3 text-xs font-bold tracking-widest text-gold uppercase">{eyebrow}</p>}
          <h1 className="max-w-3xl text-[2.25rem] leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-6xl">{title}</h1>
          {description && <p className="mt-4 max-w-2xl text-base text-white/75 sm:text-lg">{description}</p>}
          {children && <div className="mt-6">{children}</div>}
        </div>
        {art && (
          <div className="relative mx-auto hidden aspect-square w-full max-w-[280px] md:block">
            <Image src={art} alt="" fill priority sizes="280px" className="animate-float object-contain drop-shadow-[0_24px_30px_rgb(2_20_28/0.55)]" />
          </div>
        )}
      </Container>
    </section>
  );
}

export function SectionBlock({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-12 sm:py-20", className)}>
      <Container>
        {(title || description) && <SectionHeading eyebrow={eyebrow} title={title} description={description} />}
        {children}
      </Container>
    </section>
  );
}

export function FeatureCard({ icon: Icon, art, title, children, className }: { icon?: LucideIcon; art?: string; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border bg-card p-5 sm:p-6", className)}>
      {art ? (
        <div className="relative mb-4 size-14">
          <Image src={art} alt="" fill sizes="56px" className="object-contain" />
        </div>
      ) : (
        Icon && (
          <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-primary">
            <Icon className="size-6" aria-hidden />
          </div>
        )
      )}
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-1.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4 rounded-3xl border bg-card p-5 sm:flex-col sm:gap-0 sm:p-6">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold font-heading font-bold text-[oklch(0.3_0.08_55)]">{i + 1}</span>
          <span>
            <h3 className="font-bold sm:mt-4">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CtaBand({
  title = "Your adventure is waiting",
  description = "Create a free account and claim your first daily spin today.",
  signedIn = false,
}: {
  title?: string;
  description?: string;
  signedIn?: boolean;
}) {
  return (
    <section className="py-12 sm:py-20">
      <Container>
        <div className="relative isolate overflow-hidden rounded-3xl px-5 py-12 text-center text-white sm:px-12 sm:py-16">
          <Image src="/illustrations/adventure/map-1.webp" alt="" fill sizes="(min-width: 1024px) 1100px, 100vw" className="-z-10 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[oklch(0.25_0.06_222/0.8)]" />
          <h2 className="text-3xl font-bold sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">{description}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LandingButton asChild>
              <Link href={signedIn ? "/home" : "/register"}>{signedIn ? "Continue my adventure" : "Get started free"}</Link>
            </LandingButton>
            <LandingButton asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/how-it-works">How it works</Link>
            </LandingButton>
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
