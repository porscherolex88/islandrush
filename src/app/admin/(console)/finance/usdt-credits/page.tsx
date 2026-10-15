import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { listUsdtCreditLogs } from "@/server/services/usdt-deposits";

export const metadata: Metadata = { title: "USDT credits" };

export default async function UsdtCreditsPage() {
  await requireAdmin("finance.view");
  const logs = await listUsdtCreditLogs(100);
  return (
    <AdminPage title="USDT credit log" description="Every auto-credited TRC20 deposit. Append-only for review.">
      <AdminCard bodyClassName="p-0">
        {logs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No USDT credits yet.</p>
        ) : (
          <div className="divide-y">
            {logs.map((l) => (
              <div key={l.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-semibold tabular">
                    {l.amount} USDT → {l.creditedCash} Cash
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{l.txId}</p>
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/admin/finance/deposits/${l.depositId}`} className="text-primary hover:underline">
                      Deposit
                    </Link>{" "}
                    · user {l.userId.slice(0, 8)} · {l.confirmations} conf
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
