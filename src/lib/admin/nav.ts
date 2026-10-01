import type { Permission } from "@/lib/permissions";

export type NavLink = { label: string; href: string; permission: Permission };
export type NavGroup = { label: string; icon: string; href?: string; permission?: Permission; children?: NavLink[] };

const m = (key: string) => `/admin/manage/${key}`;

export const ADMIN_NAV: NavGroup[] = [
  { label: "Dashboard", icon: "LayoutDashboard", href: "/admin", permission: "dashboard.view" },
  { label: "Users", icon: "Users", href: "/admin/users", permission: "users.view" },
  {
    label: "Finance",
    icon: "Landmark",
    children: [
      { label: "Deposits", href: "/admin/finance/deposits", permission: "finance.view" },
      { label: "Withdrawals", href: "/admin/finance/withdrawals", permission: "finance.view" },
      { label: "Ledger", href: "/admin/finance/ledger", permission: "finance.view" },
      { label: "Transactions", href: "/admin/finance/transactions", permission: "finance.view" },
      { label: "Reconciliation", href: "/admin/finance/reconciliation", permission: "reconciliation.view" },
      { label: "Adjustments", href: "/admin/finance/adjustments", permission: "ledger.adjust" },
      { label: "Payment Accounts", href: m("paymentAccounts"), permission: "deposits.manage" },
    ],
  },
  {
    label: "Economy",
    icon: "Coins",
    children: [
      { label: "Overview", href: "/admin/economy", permission: "economy.manage" },
      { label: "Credit Conversion", href: "/admin/economy/settings/conversion", permission: "economy.manage" },
      { label: "Reward Rules", href: m("pools"), permission: "economy.manage" },
      { label: "Game Pricing", href: "/admin/economy/pricing", permission: "economy.manage" },
      { label: "Withdrawal Rules", href: "/admin/economy/settings/withdrawal", permission: "economy.manage" },
      { label: "Limits", href: "/admin/economy/settings/limits", permission: "economy.manage" },
      { label: "Market", href: "/admin/economy/settings/market", permission: "economy.manage" },
      { label: "Global Configuration", href: "/admin/system/settings", permission: "system.manage" },
    ],
  },
  {
    label: "Adventure",
    icon: "Map",
    children: [
      { label: "Overview", href: "/admin/games/adventure", permission: "games.manage" },
      { label: "Mystery Boxes", href: m("boxes"), permission: "games.manage" },
      { label: "Maps", href: m("maps"), permission: "games.manage" },
      { label: "Checkpoints", href: m("checkpoints"), permission: "games.manage" },
      { label: "Loot Items", href: `${m("items")}?kind=LOOT`, permission: "collections.manage" },
      { label: "Big Mystery Boxes", href: m("bigBoxes"), permission: "games.manage" },
      { label: "Puzzles", href: m("puzzles"), permission: "games.manage" },
      { label: "Prizes", href: m("prizes"), permission: "games.manage" },
      { label: "Prize Wheel", href: "/admin/economy/settings/prize_wheel", permission: "games.manage" },
      { label: "Prize Claims", href: "/admin/games/prize-claims", permission: "games.manage" },
    ],
  },
  {
    label: "Games",
    icon: "Gamepad2",
    children: [
      { label: "Legacy Map Areas", href: m("areas"), permission: "games.manage" },
      { label: "Legacy Map Tiles", href: m("tiles"), permission: "games.manage" },
      { label: "Legacy Vaults", href: m("vaults"), permission: "games.manage" },
      { label: "Daily Spin", href: "/admin/daily?focus=spin", permission: "daily.manage" },
      { label: "Daily Missions", href: m("missions"), permission: "daily.manage" },
      { label: "Daily Mystery Events", href: "/admin/daily?focus=event", permission: "daily.manage" },
      { label: "Streaks", href: m("streakMilestones"), permission: "daily.manage" },
    ],
  },
  {
    label: "Collections",
    icon: "Gem",
    children: [
      { label: "Collections", href: m("collections"), permission: "collections.manage" },
      { label: "Collection Items", href: `${m("items")}?kind=COLLECTIBLE`, permission: "collections.manage" },
      { label: "Fragments", href: `${m("items")}?kind=FRAGMENT`, permission: "collections.manage" },
      { label: "Special Items", href: `${m("items")}?kind=SPECIAL`, permission: "collections.manage" },
      { label: "Keys", href: `${m("items")}?kind=KEY`, permission: "collections.manage" },
      { label: "Completion Rewards", href: "/admin/collections/rewards", permission: "collections.manage" },
    ],
  },
  { label: "Daily Content", icon: "CalendarDays", href: "/admin/daily", permission: "daily.manage" },
  {
    label: "Progression",
    icon: "TrendingUp",
    children: [
      { label: "XP Rules", href: m("xpRules"), permission: "progression.manage" },
      { label: "XP Levels", href: "/admin/progression/xp-levels", permission: "progression.manage" },
      { label: "Deposit Levels", href: "/admin/progression/deposit-levels", permission: "progression.manage" },
      { label: "Achievements", href: m("achievements"), permission: "progression.manage" },
      { label: "Badges", href: "/admin/progression/badges", permission: "progression.manage" },
    ],
  },
  {
    label: "Referrals",
    icon: "Share2",
    children: [
      { label: "Configuration", href: "/admin/economy/settings/referral", permission: "referrals.manage" },
      { label: "Levels", href: m("referralLevels"), permission: "referrals.manage" },
      { label: "Qualifying Deposits", href: "/admin/referrals/qualifying", permission: "referrals.view" },
      { label: "Rewards", href: "/admin/referrals/rewards", permission: "referrals.view" },
      { label: "Referral Tree", href: "/admin/referrals/tree", permission: "referrals.view" },
      { label: "Referral Risk", href: "/admin/risk/flags?group=referral", permission: "risk.view" },
    ],
  },
  {
    label: "Risk & Security",
    icon: "ShieldAlert",
    children: [
      { label: "Risk Dashboard", href: "/admin/risk", permission: "risk.view" },
      { label: "Risk Rules", href: "/admin/economy/settings/risk", permission: "risk.manage" },
      { label: "Flagged Accounts", href: "/admin/risk/flags", permission: "risk.view" },
      { label: "Login Activity", href: "/admin/risk/logins", permission: "risk.view" },
      { label: "Device/IP Signals", href: "/admin/risk/signals", permission: "risk.view" },
      { label: "Manual Reviews", href: "/admin/risk/flags?status=IN_REVIEW", permission: "risk.view" },
      { label: "Suspensions", href: "/admin/users?status=SUSPENDED", permission: "users.view" },
    ],
  },
  {
    label: "Notifications",
    icon: "Bell",
    children: [
      { label: "Templates", href: m("templates"), permission: "notifications.manage" },
      { label: "Broadcasts", href: m("broadcasts"), permission: "notifications.manage" },
      { label: "In-App Notifications", href: "/admin/notifications", permission: "notifications.manage" },
    ],
  },
  {
    label: "Reports",
    icon: "BarChart3",
    children: [
      { label: "Financial", href: "/admin/reports?group=finance", permission: "reports.view" },
      { label: "Users", href: "/admin/reports?group=users", permission: "reports.view" },
      { label: "Games", href: "/admin/reports?group=games", permission: "reports.view" },
      { label: "Rewards", href: "/admin/reports?group=collections", permission: "reports.view" },
      { label: "Referrals", href: "/admin/reports?group=referrals", permission: "reports.view" },
      { label: "Retention", href: "/admin/reports?group=retention", permission: "reports.view" },
      { label: "Export Center", href: "/admin/reports/export", permission: "reports.view" },
    ],
  },
  {
    label: "Support",
    icon: "LifeBuoy",
    children: [
      { label: "Tickets", href: "/admin/support", permission: "support.view" },
      { label: "User Messages", href: "/admin/support?status=OPEN", permission: "support.view" },
      { label: "Internal Notes", href: "/admin/support/notes", permission: "support.view" },
    ],
  },
  {
    label: "Content",
    icon: "FileText",
    children: [
      { label: "Public Pages", href: m("contentPages"), permission: "content.manage" },
      { label: "FAQ", href: m("faqs"), permission: "content.manage" },
      { label: "Help Articles", href: m("helpArticles"), permission: "content.manage" },
      { label: "Banners", href: `${m("banners")}?kind=BANNER`, permission: "content.manage" },
      { label: "Announcements", href: `${m("banners")}?kind=ANNOUNCEMENT`, permission: "content.manage" },
    ],
  },
  {
    label: "Admin Management",
    icon: "UserCog",
    children: [
      { label: "Admin Users", href: "/admin/admins", permission: "admins.manage" },
      { label: "Roles", href: "/admin/admins/roles", permission: "admins.manage" },
      { label: "Permissions", href: "/admin/admins/roles#matrix", permission: "admins.manage" },
      { label: "Sessions", href: "/admin/admins/sessions", permission: "admins.manage" },
    ],
  },
  { label: "Audit Logs", icon: "ScrollText", href: "/admin/audit", permission: "audit.view" },
  {
    label: "System",
    icon: "Settings",
    children: [
      { label: "Feature Flags", href: "/admin/system", permission: "system.manage" },
      { label: "Application Settings", href: "/admin/system/settings", permission: "system.manage" },
      { label: "Maintenance Mode", href: "/admin/system/maintenance", permission: "system.manage" },
      { label: "Jobs/Tasks", href: "/admin/system/jobs", permission: "system.manage" },
      { label: "System Health", href: "/admin/system/health", permission: "system.manage" },
    ],
  },
];

export function navForPermissions(can: (p: Permission) => boolean): NavGroup[] {
  return ADMIN_NAV.flatMap((g) => {
    if (g.children) {
      const children = g.children.filter((c) => can(c.permission));
      return children.length ? [{ ...g, children }] : [];
    }
    return g.permission && !can(g.permission) ? [] : [g];
  });
}
