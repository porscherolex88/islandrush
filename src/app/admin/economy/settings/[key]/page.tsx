import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfigForm } from "@/components/admin/config-form";
import { AdminCard, AdminPage, DiffView } from "@/components/admin/ui";
import { db } from "@/db";
import { auditLogs, rewardPools } from "@/db/schema";
import type { Permission } from "@/lib/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { CONFIG_DEFAULTS, CONFIG_DESCRIPTIONS, getConfig, type ConfigKey } from "@/server/services/config";

const PAGES: Partial<Record<ConfigKey, { title: string; permission: Permission; help?: Record<string, string> }>> = {
  conversion: { title: "Credit conversion", permission: "economy.manage", help: { cash: "RM amount, e.g. 1000.00", credits: "Credits received for that RM amount" } },
  deposit: { title: "Deposit rules", permission: "economy.manage", help: { min: "Minimum deposit in RM", max: "Maximum deposit in RM", methods: "One method per line: BANK_TRANSFER, DUITNOW" } },
  withdrawal: {
    title: "Withdrawal rules",
    permission: "economy.manage",
    help: { min: "RM", maxPerRequest: "RM", maxDaily: "RM per rolling 24 hours", minDepositLevelOrder: "0 to allow all levels, otherwise the minimum Deposit Level order" },
  },
  rewards: { title: "Reward settlement", permission: "economy.manage", help: { pendingHours: "Hours before game cash rewards become withdrawable" } },
  limits: { title: "Game limits", permission: "economy.manage", help: { gameActionsPerMinute: "Rate limit per player", maxBoxOpensPerDay: "Empty for unlimited" } },
  referral: { title: "Referral configuration", permission: "referrals.manage", help: { levels: "1 to 3", qualifyingDepositMin: "RM", pendingHours: "Hours before referral rewards settle", velocityThresholdPerDay: "Qualifying referrals per day that trigger a risk flag" } },
  risk: { title: "Risk rules", permission: "risk.manage", help: { rapidSignupPerIpPerDay: "Signups per IP per day before flagging", largeDepositAmount: "RM amount that flags a deposit for review" } },
  prize_wheel: {
    title: "Final Prize Unlock",
    permission: "games.manage",
    help: {
      active: "Turn off to pause all final unlocks. Completed puzzles stay complete.",
      prizeUnlockPct: "Chance (%) the prize unlocks. Shown to players.",
      alternativePct: "Chance (%) of the puzzle's alternative reward. Both must total exactly 100.",
    },
  },
  daily_defaults: { title: "Daily defaults", permission: "daily.manage", help: { freeDiscoveries: "Free map discoveries per day", streakGraceDays: "Missed days allowed before a streak resets", streakSpinMinDays: "Streak length that grants a bonus spin" } },
};

export async function generateMetadata({ params }: PageProps<"/admin/economy/settings/[key]">): Promise<Metadata> {
  return { title: PAGES[(await params).key as ConfigKey]?.title ?? "Settings" };
}

export default async function SettingsPage({ params }: PageProps<"/admin/economy/settings/[key]">) {
  const key = (await params).key as ConfigKey;
  const page = PAGES[key];
  if (!page) notFound();
  await requireAdmin(page.permission);
  const [value, pools, history] = await Promise.all([
    getConfig(key),
    db.select({ value: rewardPools.id, label: rewardPools.name }).from(rewardPools).orderBy(rewardPools.name),
    db.select().from(auditLogs).where(and(eq(auditLogs.entityType, "app_config"), eq(auditLogs.entityId, key))).orderBy(desc(auditLogs.id)).limit(10),
  ]);
  return (
    <AdminPage title={page.title} description={CONFIG_DESCRIPTIONS[key]}>
      <AdminCard>
        <ConfigForm configKey={key} value={value as never} defaults={CONFIG_DEFAULTS[key] as never} pools={pools} help={page.help} />
      </AdminCard>
      <AdminCard title="Change history">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet. Defaults are in effect.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <details key={h.id} className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm">
                  {formatDateTime(h.createdAt)} · {h.actorRole} · <span className="text-muted-foreground">{h.reason}</span>
                </summary>
                <div className="mt-2">
                  <DiffView before={h.before} after={h.after} />
                </div>
              </details>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
