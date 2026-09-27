import type { Metadata } from "next";
import { WithdrawalAccounts } from "@/components/app/account-forms";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { requireUser } from "@/lib/auth/session";
import { userWithdrawalAccounts } from "@/server/services/withdrawals";

export const metadata: Metadata = { title: "Withdrawal accounts" };

export default async function WithdrawalAccountsPage() {
  const user = await requireUser();
  const accounts = await userWithdrawalAccounts(user.id);
  return (
    <div>
      <PageHeader title="Withdrawal accounts" subtitle="Where we send your withdrawals" back="/app/account" />
      <Section>
        <WithdrawalAccounts
          accounts={accounts.map((a) => ({ id: a.id, bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, isDefault: a.isDefault }))}
          defaultName={user.name}
        />
      </Section>
    </div>
  );
}
