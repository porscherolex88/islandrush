import { ContentPage, contentMetadata } from "@/components/public/content-page";

export const revalidate = 300;
export const generateMetadata = () => contentMetadata("privacy", "Privacy Policy");

export default function PrivacyPage() {
  return <ContentPage slug="privacy" />;
}
