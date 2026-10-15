import { BookOpen, Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero } from "@/components/public/marketing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with the LootBox support team." };

const SUPPORT_EMAIL = "support@lootbox.my";

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="We're here to help" description="Our support team replies within a few hours, every day." art="/illustrations/3d/prize-gift.webp" />
      <Container className="grid gap-4 py-10 sm:py-14 md:grid-cols-3 md:gap-5">
        <div className="rounded-3xl border bg-card p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-primary"><MessageCircle className="size-6" aria-hidden /></span>
          <h2 className="mt-4 text-lg font-bold">Support ticket</h2>
          <p className="mt-1 text-sm text-muted-foreground">The fastest way to reach us about deposits, withdrawals or your account.</p>
          <Button asChild variant="gold" size="pill" className="mt-4 w-full">
            <Link href="/account/support">Open a ticket</Link>
          </Button>
        </div>
        <div className="rounded-3xl border bg-card p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-primary"><Mail className="size-6" aria-hidden /></span>
          <h2 className="mt-4 text-lg font-bold">Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">Can&apos;t sign in? Request a password reset, or email us.</p>
          <Button asChild variant="outline" size="pill" className="mt-4 w-full">
            <Link href="/forgot-password">Forgot password</Link>
          </Button>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 block text-center text-xs font-semibold text-primary underline">
            {SUPPORT_EMAIL}
          </a>
        </div>
        <div className="rounded-3xl border bg-card p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-primary"><BookOpen className="size-6" aria-hidden /></span>
          <h2 className="mt-4 text-lg font-bold">Help centre</h2>
          <p className="mt-1 text-sm text-muted-foreground">Guides and answers to the most common questions.</p>
          <Button asChild variant="outline" size="pill" className="mt-4 w-full">
            <Link href="/help">Browse guides</Link>
          </Button>
        </div>
      </Container>
      <Container className="pb-14">
        <p className="rounded-3xl bg-surface p-4 text-center text-sm text-muted-foreground">LootBox staff will never ask for your password or ask you to transfer money to a personal account.</p>
      </Container>
    </>
  );
}
