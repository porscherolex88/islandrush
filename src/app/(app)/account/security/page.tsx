import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PasswordForm, SessionList, type SessionView } from "@/components/app/account-forms";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Panel, Section } from "@/components/app/mobile-header";
import { getAuth } from "@/lib/auth/server";
import { getAuthSession, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Security" };

type RawSession = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; createdAt: string | Date };

export default async function SecurityPage() {
  await requireUser();
  const [current, list] = await Promise.all([getAuthSession(), getAuth().listSessions()]);
  const raw = (Array.isArray(list.data) ? list.data : []) as RawSession[];
  const sessions: SessionView[] = raw
    .map((s) => ({
      id: s.id,
      token: s.token,
      userAgent: s.userAgent ?? null,
      ipAddress: s.ipAddress ?? null,
      createdAt: new Date(s.createdAt).toISOString(),
      current: s.id === current?.session.id,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <InnerPageHeader title="Security" subtitle="Password and signed-in devices" />
      <Section title="Change password">
        <Panel>
          <PasswordForm />
        </Panel>
      </Section>
      <Section title="Signed-in devices">
        <div id="sessions" className="scroll-mt-20">
          {sessions.length ? <SessionList sessions={sessions} /> : <p className="text-sm text-muted-foreground">No active sessions found.</p>}
        </div>
      </Section>
      <Section>
        <p className="flex gap-2 rounded-xl bg-surface p-3 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Passwords are hashed and never stored in plain text. Sessions use secure, HTTP-only cookies. If you notice a device you don&apos;t recognise, sign it out and change your password.
        </p>
      </Section>
    </div>
  );
}
