import Link from "next/link";
import { LogoMark } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface p-6 text-center">
      <div className="max-w-sm space-y-3">
        <LogoMark className="mx-auto size-14" />
        <h1 className="text-3xl font-bold">Nothing buried here</h1>
        <p className="text-muted-foreground">This page doesn&apos;t exist or has moved. Let&apos;s get you back on the map.</p>
        <Button asChild size="xl">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
