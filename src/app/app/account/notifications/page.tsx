import type { Metadata } from "next";
import { NotificationPrefsForm } from "@/components/app/account-forms";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Notification Settings" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  return (
    <div>
      <InnerPageHeader title="Notification Settings" />
      <Section>
        <NotificationPrefsForm prefs={user.notificationPrefs} />
      </Section>
    </div>
  );
}
