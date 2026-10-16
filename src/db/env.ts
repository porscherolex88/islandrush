/** True when a Neon connection string is available (runtime queries need this). */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
