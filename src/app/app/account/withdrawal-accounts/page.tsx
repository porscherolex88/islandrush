import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import { WithdrawalAccounts } from "@/components/app/account-forms";
import { InnerPageHeader } from "@/components/app/inner-page-header";
import { Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";
import { userWithdrawalAccounts } from "@/server/services/withdrawals";

export const metadata: Metadata = { title: "Bank Accounts" };

export default async function WithdrawalAccountsPage() {
  const user = await requireUser();
  const accounts = await userWithdrawalAccounts(user.id);
  return (
    <div>
      <InnerPageHeader title="Bank Accounts" subtitle="Where we send your withdrawals" icon={<Landmark />} />
      <Section>
        <WithdrawalAccounts
          accounts={accounts.map((a) => ({ id: a.id, bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, isDefault: a.isDefault }))}
          defaultName={user.name}
        />
      </Section>
    </div>
  );
}
