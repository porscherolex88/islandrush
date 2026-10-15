import path from "node:path";
import { vi } from "vitest";

// Test-only licence so wallet integration tests can exercise money paths.
// Production must leave LICENCE_NUMBER unset until the Curaçao licence is verified.
process.env.LICENCE_NUMBER ??= "TEST-LICENCE-ONLY";
process.env.LICENSED_ENTITY ??= "LootBox Games Pte Ltd";
process.env.USDT_TRC20_WALLET ??= "TTestUsdtWalletAddressForVitest0001";

vi.mock("@/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("@/db/schema");
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  return { db, schema };
});
