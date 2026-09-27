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
      <PageHero eyebrow="Contact" title="We're here to help" description="Our support team replies within a few hours, every day." />
      <Container className="grid max-w-4xl gap-5 py-12 md:grid-cols-3">
        <div className="rounded-3xl border bg-card p-6">
          <MessageCircle className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 font-bold">Support ticket</h2>
          <p className="mt-1 text-sm text-muted-foreground">The fastest way to reach us about deposits, withdrawals or your account.</p>
          <Button asChild className="mt-4 w-full">
            <Link href="/app/account/support">Open a ticket</Link>
          </Button>
        </div>
        <div className="rounded-3xl border bg-card p-6">
          <Mail className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 font-bold">Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">Can&apos;t sign in? Email us from the address on your account.</p>
          <Button asChild variant="outline" className="mt-4 w-full">
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </Button>
        </div>
        <div className="rounded-3xl border bg-card p-6">
          <BookOpen className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 font-bold">Help centre</h2>
          <p className="mt-1 text-sm text-muted-foreground">Guides and answers to the most common questions.</p>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href="/help">Browse guides</Link>
          </Button>
        </div>
      </Container>
      <Container className="max-w-4xl pb-14">
        <p className="text-center text-sm text-muted-foreground">LootBox staff will never ask for your password or ask you to transfer money to a personal account.</p>
      </Container>
    </>
  );
}
