import { ContentPage, contentMetadata } from "@/components/public/content-page";

export const revalidate = 300;
export const generateMetadata = () => contentMetadata("terms", "Terms of Service");

export default function TermsPage() {
  return <ContentPage slug="terms" />;
}
