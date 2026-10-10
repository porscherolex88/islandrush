import { Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConvertForm } from "@/components/app/convert-form";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { toDecimal, toMinor } from "@/lib/money";
import { getRate } from "@/server/services/conversion";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Convert to Credits" };

export default async function ConvertPage({ searchParams }: PageProps<"/app/wallet/convert">) {
  const user = await requireUser();
  const [b, rate, sp] = await Promise.all([getBalances(user.id), getRate(), searchParams]);
  const requested = typeof sp.amount === "string" && /^\d+(\.\d{1,2})?$/.test(sp.amount) ? sp.amount : "";
  const initialAmount = requested && toMinor(requested) > 0n && toMinor(requested) <= b.CASH ? requested : "";
  return (
    <div>
      <InnerPageHeader title="Convert to Credits" subtitle="Turn Cash into Credits to play" />
      <Section>
        {b.CASH === 0n ? (
          <EmptyState
            icon={<Repeat className="size-8 text-primary" />}
            title="You have no Cash to convert"
            description="Deposit money first. Once it is approved it becomes Cash, and you can turn it into Credits here."
            action={
              <Button variant="gold" asChild size="pill">
                <Link href="/app/wallet/deposit">Make a deposit</Link>
              </Button>
            }
          />
        ) : (
          <ConvertForm cash={toDecimal(b.CASH)} rateCash={rate.cash} rateCredits={rate.creditsNumber} initialAmount={initialAmount} />
        )}
      </Section>
    </div>
  );
}
