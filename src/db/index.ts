import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as {
  __lootboxSql?: ReturnType<typeof postgres>;
  __lootboxDb?: Db;
};

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const client =
    globalForDb.__lootboxSql ??
    postgres(connectionString, {
      max: 10,
      // Supabase pooler (PgBouncer transaction mode) does not support prepared statements.
      prepare: false,
    });
  globalForDb.__lootboxSql = client;
  return drizzle({ client, schema });
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
