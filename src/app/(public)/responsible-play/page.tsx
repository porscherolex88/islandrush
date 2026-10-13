import Link from "next/link";
import { ContentPage, contentMetadata } from "@/components/public/content-page";
import { Container } from "@/components/public/marketing";
import { Button } from "@/components/ui/button";

export const revalidate = 300;
export const generateMetadata = () => contentMetadata("responsible-play", "Responsible Play");

export default function ResponsiblePlayPublicPage() {
  return (
    <>
      <ContentPage slug="responsible-play" />
      <Container className="max-w-2xl pb-14">
        <div className="rounded-3xl bg-brand-soft p-6">
          <p className="font-semibold">Set your limits now</p>
          <p className="mt-1 text-sm text-muted-foreground">Signed-in players can set a daily Credit limit or take a break in a few taps.</p>
          <Button asChild variant="gold" size="pill" className="mt-4">
            <Link href="/account/responsible-play">Open responsible play settings</Link>
          </Button>
        </div>
      </Container>
    </>
  );
}
