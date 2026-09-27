"use client";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      className="mx-auto mt-10 max-w-lg"
      description={error.digest ? `This page failed to load (ref ${error.digest}). Try again or check System Health.` : "This page failed to load. Try again or check System Health."}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
