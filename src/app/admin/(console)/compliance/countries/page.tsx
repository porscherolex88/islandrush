import type { Metadata } from "next";
import { RESTRICTED_REAL_MONEY_COUNTRIES } from "@/lib/compliance/restricted-countries";
import { requireAdmin } from "@/lib/auth/session";
import { AdminCard, AdminPage } from "@/components/admin/ui";
import { CountryControlsForm } from "@/components/admin/country-controls-form";
import { listCountryControls } from "@/server/services/country-access";

export const metadata: Metadata = { title: "Country controls" };

export default async function CountryControlsPage() {
  await requireAdmin("system.manage");
  const rows = await listCountryControls();
  return (
    <AdminPage
      title="Country controls"
      description="Per-country site access, free play, deposits and withdrawals. Unconfigured countries have deposits OFF. Hard-coded restricted countries cannot enable real-money features."
    >
      <AdminCard title="Hard-coded restricted (code review only)" description="Deposits and withdrawals stay off regardless of admin toggles.">
        <p className="font-mono text-xs leading-relaxed">{RESTRICTED_REAL_MONEY_COUNTRIES.join(", ")}</p>
      </AdminCard>
      <AdminCard title="Configured countries">
        <CountryControlsForm existing={rows} />
      </AdminCard>
    </AdminPage>
  );
}
