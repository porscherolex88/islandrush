import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { ProfileForm } from "@/components/app/account-forms";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div>
      <InnerPageHeader title="Profile" icon={<UserRound />} />
      <Section>
        <ProfileForm name={user.name} phone={user.phone ?? ""} email={user.email} />
      </Section>
    </div>
  );
}
