/**
 * One-shot copy of Neon Postgres data into Supabase (public + neon_auth).
 * Requires POSTGRES_URL_NON_POOLING (Neon) and DATABASE_URL_UNPOOLED (Supabase) in .env.local.
 */
import "dotenv/config";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const NEON_URL = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL_NEON;
const SUPA_URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!NEON_URL?.includes("neon")) {
  console.error("Set POSTGRES_URL_NON_POOLING to your Neon direct connection string.");
  process.exit(1);
}
if (!SUPA_URL?.includes("supabase")) {
  console.error("Set DATABASE_URL_UNPOOLED to your Supabase connection string.");
  process.exit(1);
}

const neon = postgres(NEON_URL, { max: 1, prepare: false });
const supa = postgres(SUPA_URL, { max: 1, prepare: false });

function qIdent(schema: string, table: string) {
  return `"${schema.replace(/"/g, '""')}"."${table.replace(/"/g, '""')}"`;
}

async function syncColumns(schema: string, table: string) {
  const neonCols = await neon`
    SELECT a.attname AS name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
      a.attnotnull AS notnull,
      pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE n.nspname = ${schema} AND c.relname = ${table}
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
  `;
  const supaNames = new Set(
    (
      await supa`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = ${table}
    `
    ).map((r) => r.column_name),
  );
  for (const c of neonCols) {
    if (supaNames.has(c.name)) continue;
    let ddl = `ALTER TABLE ${qIdent(schema, table)} ADD COLUMN "${c.name}" ${c.type}`;
    if (c.notnull) ddl += " NOT NULL";
    if (c.default_expr) ddl += ` DEFAULT ${c.default_expr}`;
    console.log(`  add column ${schema}.${table}.${c.name}`);
    await supa.unsafe(ddl);
  }
}

async function createTableFromNeon(schema: string, table: string) {
  const cols = await neon`
    SELECT a.attname AS name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
      a.attnotnull AS notnull,
      pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE n.nspname = ${schema} AND c.relname = ${table}
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
  `;
  if (!cols.length) throw new Error(`No columns for ${schema}.${table}`);

  const colDefs = cols.map((c) => {
    let def = `"${c.name}" ${c.type}`;
    if (c.notnull) def += " NOT NULL";
    if (c.default_expr) def += ` DEFAULT ${c.default_expr}`;
    return def;
  });

  const pk = await neon`
    SELECT a.attname AS name
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = ${schema} AND c.relname = ${table} AND i.indisprimary
    ORDER BY array_position(i.indkey, a.attnum)
  `;
  if (pk.length) colDefs.push(`PRIMARY KEY (${pk.map((p) => `"${p.name}"`).join(", ")})`);

  const ddl = `CREATE TABLE IF NOT EXISTS ${qIdent(schema, table)} (${colDefs.join(", ")})`;
  await supa.unsafe(ddl);
}

async function copyTable(schema: string, table: string) {
  const [{ n }] = await neon.unsafe<{ n: string }[]>(
    `SELECT count(*)::text AS n FROM ${qIdent(schema, table)}`,
  );
  if (Number(n) === 0) {
    console.log(`  skip ${schema}.${table} (empty)`);
    return;
  }

  const rows = await neon.unsafe(`SELECT * FROM ${qIdent(schema, table)}`);
  const cols = Object.keys(rows[0] as object);
  const colList = cols.map((c) => `"${c}"`).join(", ");

  await supa.unsafe(`TRUNCATE ${qIdent(schema, table)} CASCADE`);

  for (const row of rows as Record<string, unknown>[]) {
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const values = cols.map((c) => row[c]);
    await supa.unsafe(`INSERT INTO ${qIdent(schema, table)} (${colList}) VALUES (${placeholders})`, values as never[]);
  }
  console.log(`  copied ${schema}.${table}: ${rows.length} rows`);
}

async function main() {
  console.log("Copying Neon → Supabase…");

  await supa`CREATE SCHEMA IF NOT EXISTS neon_auth`;

  const neonAuthTables = await neon`
    SELECT tablename FROM pg_tables WHERE schemaname = 'neon_auth' ORDER BY tablename
  `;
  for (const { tablename } of neonAuthTables) {
    console.log(`DDL neon_auth.${tablename}`);
    await createTableFromNeon("neon_auth", tablename);
  }

  const publicTables = await neon`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('__drizzle_migrations')
    ORDER BY tablename
  `;

  const supaPublicSet = new Set(
    (await supa`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`).map((r) => r.tablename),
  );
  for (const { tablename } of publicTables) {
    if (!supaPublicSet.has(tablename)) {
      console.log(`DDL public.${tablename} (missing on Supabase)`);
      await createTableFromNeon("public", tablename);
      supaPublicSet.add(tablename);
    } else {
      await syncColumns("public", tablename);
    }
  }

  await supa`SET session_replication_role = replica`;

  const supaPublic = [...supaPublicSet].filter((t) => t !== "__drizzle_migrations");
  if (supaPublic.length) {
    const list = supaPublic.map((t) => qIdent("public", t)).join(", ");
    console.log("Truncating Supabase public tables…");
    await supa.unsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }

  for (const { tablename } of neonAuthTables) {
    await copyTable("neon_auth", tablename);
  }
  for (const { tablename } of publicTables) {
    await copyTable("public", tablename);
  }

  await supa`SET session_replication_role = DEFAULT`;

  const [{ profiles }] = await supa`SELECT count(*)::int AS profiles FROM profiles`;
  const [{ users }] = await supa`SELECT count(*)::int AS users FROM neon_auth."user"`;
  console.log(`Done. profiles=${profiles}, auth users=${users}`);
  await neon.end();
  await supa.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
