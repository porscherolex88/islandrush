import { Pool } from "@neondatabase/serverless";
const p = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await p.query("select table_schema, table_name from information_schema.tables where table_schema not in ('public','pg_catalog','information_schema') order by 1,2");
console.log(r.rows);
const c = await p.query("select column_name from information_schema.columns where table_schema='neon_auth' and table_name='session'");
console.log(c.rows.map(x=>x.column_name).join(","));
await p.end();
