import type { Metadata } from "next";
import Link from "next/link";
import { VerificationUploadForm } from "@/components/app/account-forms";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Panel, Section } from "@/components/app/mobile-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verification" };

const COPY: Record<string, { title: string; body: string }> = {
  UNVERIFIED: {
    title: "Identity check required",
    body: "Before your first withdrawal, upload a photo of your government ID and a proof of address. Our team reviews every submission.",
  },
  PENDING: { title: "Under review", body: "Our team is reviewing your documents. We will notify you when it is done, usually within 1-2 business days." },
  VERIFIED: { title: "You're verified", body: "Your identity documents were approved. Thanks for helping keep LootBox safe." },
  REJECTED: { title: "Verification unsuccessful", body: "We could not verify your documents. Upload clearer files and try again, or contact support." },
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
        </Panel>
      </Section>
      {canRequest && (
        <Section>
          <ol className="mb-4 space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-primary">1</span>
              <span>
                Confirm your{" "}
                <Link href="/account/profile" className="font-semibold text-primary underline">
                  profile name
                </Link>{" "}
                matches your ID.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-primary">2</span>
              <span>Upload a clear photo of your ID and a recent proof of address (utility bill or bank statement).</span>
            </li>
          </ol>
          <VerificationUploadForm />
        </Section>
      )}
    </div>
  );
}
