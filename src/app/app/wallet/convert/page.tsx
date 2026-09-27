import type { Metadata } from "next";
import Link from "next/link";
import { ConvertForm } from "@/components/app/convert-form";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { toDecimal } from "@/lib/money";
import { getRate } from "@/server/services/conversion";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Convert" };

export default async function ConvertPage() {
  const user = await requireUser();
  const [b, rate] = await Promise.all([getBalances(user.id), getRate()]);
  return (
    <div>
      <PageHeader title="Convert" subtitle="Turn Cash into Credits to play" back="/app/wallet" />
      <Section>
        {b.CASH === 0n ? (
          <EmptyState
            icon="🔁"
            title="No Cash to convert yet"
            description="Make a deposit first. Once it's approved you can convert it to Credits here."
            action={
              <Button asChild>
                <Link href="/app/wallet/deposit">Deposit</Link>
              </Button>
            }
          />
        ) : (
          <ConvertForm cash={toDecimal(b.CASH)} rateCash={rate.cash} rateCredits={rate.creditsNumber} />
        )}
      </Section>
    </div>
  );
}
