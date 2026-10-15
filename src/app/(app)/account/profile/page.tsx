import type { Metadata } from "next";
import { ProfileForm } from "@/components/app/account-forms";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";
import { formatMyPhone, isPhoneAuthEmail } from "@/lib/phone";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const phoneLogin = isPhoneAuthEmail(user.email);
  const phoneDisplay = user.phone ? formatMyPhone(user.phone) : "";
  return (
    <div>
      <InnerPageHeader title="Profile" />
      <Section>
        <ProfileForm name={user.name} phone={phoneDisplay} email={user.email} phoneLogin={phoneLogin} />
      </Section>
    </div>
  );
}
