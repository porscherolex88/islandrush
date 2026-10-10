export const ROLES = ["USER", "SUPPORT", "FINANCE", "GAME_ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const ADMIN_ROLES: Role[] = ["SUPPORT", "FINANCE", "GAME_ADMIN", "SUPER_ADMIN"];

export const PERMISSIONS = {
  "dashboard.view": "View operations dashboard",
  "users.view": "View users and account state",
  "users.manage": "Suspend, verify and annotate users",
  "finance.view": "View deposits, withdrawals and ledger",
  "deposits.manage": "Approve, reject and reverse deposits",
  "withdrawals.manage": "Review and process withdrawals",
  "ledger.adjust": "Create manual ledger adjustments",
  "reconciliation.view": "Run reconciliation",
  "economy.manage": "Configure conversion, pricing and limits",
  "games.manage": "Configure Mystery Boxes, Maps and Vaults",
  "collections.manage": "Configure collections and items",
  "daily.manage": "Configure daily content",
  "progression.manage": "Configure Deposit Levels and achievements",
  "referrals.view": "View referral trees and rewards",
  "referrals.manage": "Configure referral policy",
  "risk.view": "View risk signals",
  "risk.manage": "Review risk, hold and reverse rewards",
  "support.view": "View support tickets",
  "support.manage": "Respond to and manage tickets",
  "notifications.manage": "Manage templates and broadcasts",
  "content.manage": "Manage public content, FAQ and banners",
  "reports.view": "View reports and export data",
  "admins.manage": "Manage admin users, roles and permissions",
  "audit.view": "View audit logs",
  "system.manage": "Feature flags, settings, maintenance and jobs",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  USER: [],
  SUPPORT: ["dashboard.view", "users.view", "support.view", "support.manage", "referrals.view", "risk.view"],
  FINANCE: [
    "dashboard.view",
    "users.view",
    "finance.view",
    "deposits.manage",
    "withdrawals.manage",
    "ledger.adjust",
    "reconciliation.view",
    "referrals.view",
    "risk.view",
    "risk.manage",
    "reports.view",
  ],
  GAME_ADMIN: [
    "dashboard.view",
    "users.view",
    "economy.manage",
    "games.manage",
    "collections.manage",
    "daily.manage",
    "progression.manage",
    "referrals.view",
    "referrals.manage",
    "notifications.manage",
    "content.manage",
    "reports.view",
  ],
  SUPER_ADMIN: ALL_PERMISSIONS,
};

export function isAdminRole(role: string): role is Role {
  return ADMIN_ROLES.includes(role as Role);
}
