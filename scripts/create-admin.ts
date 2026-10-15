/* eslint-disable no-console */
/**
 * One-time / ops CLI to create a staff admin account.
 * Never hard-codes credentials; reads from argv or prompts via env.
 *
 * Usage:
 *   ADMIN_USERNAME=owner ADMIN_PASSWORD='...' ADMIN_ROLE=SUPER_ADMIN npm run admin:create
 *
 * Or for first bootstrap (also available via ADMIN_BOOTSTRAP_* on login):
 *   ADMIN_BOOTSTRAP_USERNAME=owner ADMIN_BOOTSTRAP_PASSWORD='...' npm run admin:create
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const { createAdminAccount, bootstrapAdminFromEnv } = await import("@/server/services/admin-auth-core");
  const role = (process.env.ADMIN_ROLE?.trim() || "SUPER_ADMIN") as "SUPPORT" | "FINANCE" | "GAME_ADMIN" | "SUPER_ADMIN";
  const username = process.env.ADMIN_USERNAME?.trim() || process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD || process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || username || "Admin";

  if (!username || !password) {
    console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD (or ADMIN_BOOTSTRAP_USERNAME / ADMIN_BOOTSTRAP_PASSWORD).");
    process.exit(1);
  }

  const boot = await bootstrapAdminFromEnv();
  if (boot.created) {
    console.log(`Bootstrapped first admin from env: ${boot.username} (must change password on first login)`);
    return;
  }

  const row = await createAdminAccount({
    username,
    password,
    displayName,
    role,
    mustChangePassword: process.env.ADMIN_MUST_CHANGE_PASSWORD === "1",
  });
  console.log(`Created admin ${row.username} (${row.role}) id=${row.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
