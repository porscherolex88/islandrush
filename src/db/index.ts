import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

export type Db = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as { __lootboxPool?: Pool; __lootboxDb?: Db };

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  const pool = globalForDb.__lootboxPool ?? new Pool({ connectionString, max: 10 });
  globalForDb.__lootboxPool = pool;
  return drizzle({ client: pool, schema });
}

/** Lazily-initialised database handle so builds without DATABASE_URL still succeed. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    if (!globalForDb.__lootboxDb) globalForDb.__lootboxDb = createDb();
    const value = Reflect.get(globalForDb.__lootboxDb, prop, receiver);
    return typeof value === "function" ? value.bind(globalForDb.__lootboxDb) : value;
  },
});

export { schema };
