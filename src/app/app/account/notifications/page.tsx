import type { Metadata } from "next";
import { NotificationPrefsForm } from "@/components/app/account-forms";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="Notification settings" back="/app/account" />
      <Section>
        <NotificationPrefsForm prefs={user.notificationPrefs} />
      </Section>
    </div>
  );
}
