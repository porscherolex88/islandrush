"use client";

import Link from "next/link";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-4">
      <ErrorState
        action={
          <div className="flex gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/home">Home</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
