import { Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConvertForm } from "@/components/app/convert-form";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { toDecimal } from "@/lib/money";
import { getRate } from "@/server/services/conversion";
import { getBalances } from "@/server/services/ledger";

export const metadata: Metadata = { title: "Convert to Credits" };

export default async function ConvertPage() {
  const user = await requireUser();
  const [b, rate] = await Promise.all([getBalances(user.id), getRate()]);
  return (
    <div>
      <InnerPageHeader title="Convert to Credits" subtitle="Turn Cash into Credits to play" icon={<Repeat />} />
      <Section>
        {b.CASH === 0n ? (
          <EmptyState
            icon={<Repeat className="size-8 text-primary" />}
            title="You have no Cash to convert"
            description="Deposit money first. Once it is approved it becomes Cash, and you can turn it into Credits here."
            action={
              <Button asChild size="lg">
                <Link href="/app/wallet/deposit">Make a deposit</Link>
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
