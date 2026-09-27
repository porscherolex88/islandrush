import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access" };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-3 py-24 text-center">
      <ShieldX className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-bold">You don&apos;t have access to this area</h1>
      <p className="text-sm text-muted-foreground">Your role doesn&apos;t include the permission needed for this page. Ask a Super Admin if you need access.</p>
      <Button asChild variant="outline">
        <Link href="/admin">Back to dashboard</Link>
      </Button>
    </div>
  );
}
