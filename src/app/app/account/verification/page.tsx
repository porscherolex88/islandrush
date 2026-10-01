import type { Metadata } from "next";
import Link from "next/link";
import { RequestVerificationButton } from "@/components/app/account-forms";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Panel, Section } from "@/components/app/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verification" };

const COPY: Record<string, { title: string; body: string }> = {
  UNVERIFIED: { title: "Not verified yet", body: "Verification protects your account and may be required before larger withdrawals." },
  PENDING: { title: "Under review", body: "Our team is reviewing your details. We'll notify you when it's done, usually within 1-2 business days." },
  VERIFIED: { title: "You're verified", body: "Your account is fully verified. Thanks for helping keep LootBox safe." },
  REJECTED: { title: "Verification unsuccessful", body: "We couldn't verify your account with the details provided. Update your profile and try again, or contact support." },
};

export default async function VerificationPage() {
  const user = await requireUser();
  const c = COPY[user.verificationStatus];
  const canRequest = user.verificationStatus === "UNVERIFIED" || user.verificationStatus === "REJECTED";
  return (
    <div>
      <InnerPageHeader title="Verification" />
      <Section>
        <Panel className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-heading text-lg font-bold">{c.title}</p>
            <StatusBadge status={user.verificationStatus} />
          </div>
          <p className="text-sm text-muted-foreground">{c.body}</p>
          {user.verificationNote && <p className="rounded-lg bg-muted p-2 text-sm">{user.verificationNote}</p>}
          {user.verificationRequired && user.verificationStatus !== "VERIFIED" && (
            <p className="rounded-lg bg-warning-soft p-2 text-sm">Verification is required on your account before you can withdraw.</p>
          )}
        </Panel>
      </Section>
      {canRequest && (
        <Section>
          <ol className="mb-4 space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-primary">1</span>
              <span>
                Make sure your{" "}
                <Link href="/app/account/profile" className="font-semibold text-primary underline">
                  profile
                </Link>{" "}
                has your full legal name and phone number{user.phone ? "" : " (phone number missing)"}.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-primary">2</span>
              <span>Request verification. Our team may contact you to confirm your identity.</span>
            </li>
          </ol>
          <RequestVerificationButton disabled={!user.phone} />
        </Section>
      )}
    </div>
  );
}
