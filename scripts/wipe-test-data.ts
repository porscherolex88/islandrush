/* eslint-disable no-console */
/**
 * Wipe player/test data before launch. Keeps game content, config, and feature flags.
 *
 * Dry-run (counts only, default):
 *   npm run db:wipe-test
 *   npm run db:wipe-test -- --dry-run
 *
 * Execute (requires both env allow-list and typed confirmation):
 *   ALLOW_TEST_DATA_WIPE=1 npm run db:wipe-test -- --confirm=WIPE_TEST_DATA
 *
 * Never run this against production. The script refuses when VERCEL_ENV or
 * NODE_ENV is "production", when the DB URL looks like a production host, or
 * when ALLOW_TEST_DATA_WIPE is not set for execute mode.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { sql } from "drizzle-orm";

const CONFIRM_TOKEN = "WIPE_TEST_DATA";

/** Player / ledger / ops tables wiped. Content (maps, boxes, items, FAQs, etc.) is kept. */
const WIPE_TABLES = [
  "ledger_entries",
  "ledger_transactions",
  "deposits",
  "withdrawals",
  "withdrawal_accounts",
  "conversions",
  "cash_rewards",
  "uploaded_files",
  "inventory_events",
  "inventory",
  "collection_completions",
  "market_sales",
  "market_listings",
  "mystery_box_plays",
  "box_jackpots",
  "free_box_plays",
  "tile_discoveries",
  "area_unlocks",
  "vault_unlocks",
  "user_checkpoints",
  "user_map_progress",
  "big_box_openings",
  "puzzle_piece_events",
  "prize_claims",
  "prize_unlock_attempts",
  "user_puzzles",
  "game_events",
  "daily_logins",
  "daily_spins",
  "mission_progress",
  "mission_bonus_claims",
  "streak_milestone_claims",
  "user_streaks",
  "user_achievements",
  "risk_notes",
  "risk_flags",
  "user_notes",
  "notifications",
  "broadcasts",
  "support_messages",
  "support_tickets",
  "audit_logs",
  "job_runs",
  "login_events",
  "rate_limits",
  "financial_accounts",
  "profiles",
] as const;

const NEON_AUTH_TABLES = ["session", "account", "verification", "user"] as const;

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run") || !argv.some((a) => a.startsWith("--confirm="));
  const confirm = argv.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length) ?? "";
  return { dryRun: dryRun || confirm !== CONFIRM_TOKEN, confirm };
}

function dbHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function assertSafeTarget(url: string, executing: boolean) {
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run: VERCEL_ENV/NODE_ENV is production.");
  }
  const host = dbHost(url);
  const blocked =
    host.includes("prod") ||
    host.endsWith(".vercel-storage.com") ||
    process.env.LOOTBOX_ENV === "production" ||
    process.env.APP_ENV === "production";
  if (blocked) {
    throw new Error(`Refusing to run against suspected production database (${host || "unknown host"}).`);
  }
  if (executing && process.env.ALLOW_TEST_DATA_WIPE !== "1") {
    throw new Error("Refusing to execute: set ALLOW_TEST_DATA_WIPE=1 for non-dry-run wipes.");
  }
}

async function main() {
  const { dryRun, confirm } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  assertSafeTarget(url, !dryRun);

  if (!dryRun && confirm !== CONFIRM_TOKEN) {
    throw new Error(`Refusing to execute: pass --confirm=${CONFIRM_TOKEN} (after a dry-run).`);
  }

  const { db } = await import("@/db");

  console.log(dryRun ? "Dry-run: reporting counts only.\n" : "EXECUTE: wiping test data.\n");
  console.log(`Database host: ${dbHost(url) || "(unparsed)"}`);

  const counts: Record<string, number> = {};
  for (const table of WIPE_TABLES) {
    const rows = await db.execute(sql.raw(`select count(*)::int as n from "${table}"`));
    counts[table] = Number((rows.rows[0] as { n: number }).n);
  }

  let neonAuthPresent = false;
  try {
    const check = await db.execute(sql`
      select 1 as ok
      from information_schema.schemata
      where schema_name = 'neon_auth'
      limit 1
    `);
    neonAuthPresent = check.rows.length > 0;
  } catch {
    neonAuthPresent = false;
  }

  if (neonAuthPresent) {
    for (const table of NEON_AUTH_TABLES) {
      try {
        const rows = await db.execute(sql.raw(`select count(*)::int as n from neon_auth."${table}"`));
        counts[`neon_auth.${table}`] = Number((rows.rows[0] as { n: number }).n);
      } catch {
        // Table name differs across Neon Auth versions; skip missing ones.
      }
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log("Rows that would be removed:");
  for (const [table, n] of Object.entries(counts)) {
    if (n > 0) console.log(`  ${table.padEnd(36)} ${n}`);
  }
  console.log(`\nTotal rows: ${total}`);
  console.log("Kept: game content, payment_accounts, app_config, feature_flags, role_permissions, FAQ/help/content.");

  if (dryRun) {
    console.log("\nDry-run complete. To execute on a non-production DB:");
    console.log(`  ALLOW_TEST_DATA_WIPE=1 npm run db:wipe-test -- --confirm=${CONFIRM_TOKEN}`);
    return;
  }

  await db.transaction(async (tx) => {
    // Null self-FK on profiles so truncate/delete ordering cannot fail.
    await tx.execute(sql`update profiles set referred_by_id = null`);

    // Break ledger FKs from deposits/withdrawals/rewards before truncating ledger.
    await tx.execute(sql`update deposits set ledger_transaction_id = null, proof_file_id = null, reviewer_id = null`);
    await tx.execute(sql`update withdrawals set request_transaction_id = null, settle_transaction_id = null, reviewer_id = null`);
    await tx.execute(sql`update conversions set ledger_transaction_id = null`);
    await tx.execute(sql`update cash_rewards set credit_transaction_id = null, settle_transaction_id = null, reverse_transaction_id = null, deposit_id = null, referee_id = null`);
    await tx.execute(sql`update mystery_box_plays set ledger_transaction_id = null, jackpot_id = null`);
    await tx.execute(sql`update tile_discoveries set ledger_transaction_id = null`);
    await tx.execute(sql`update market_sales set ledger_transaction_id = null`);
    await tx.execute(sql`update prize_unlock_attempts set ledger_transaction_id = null`);
    await tx.execute(sql`update prize_claims set ledger_transaction_id = null, reviewer_id = null`);

    await tx.execute(sql.raw(`truncate table ${WIPE_TABLES.map((t) => `"${t}"`).join(", ")} restart identity cascade`));

    if (neonAuthPresent) {
      for (const table of NEON_AUTH_TABLES) {
        try {
          await tx.execute(sql.raw(`truncate table neon_auth."${table}" restart identity cascade`));
        } catch {
          // optional table
        }
      }
    }
  });

  console.log("\nWipe complete. Re-create staff accounts with npm run db:seed (or sign up and promote a SUPER_ADMIN).");
  console.log("Deposits remain controlled by the feature_flags.deposits toggle (Admin > System > Feature flags).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
