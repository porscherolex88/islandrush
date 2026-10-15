/** Absolute site origin without a trailing slash. */
export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lootbox-porscherolex88s-projects.vercel.app";
  return raw.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const base = siteOrigin();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
