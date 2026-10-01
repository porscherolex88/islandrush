/** The five bottom-navigation roots. Every other /app route is an inner page. */
export const ROOT_ROUTES = ["/app", "/app/play", "/app/daily", "/app/progress", "/app/account"] as const;

export type RootRoute = (typeof ROOT_ROUTES)[number];

const LABELS: Record<string, string> = {
  "/app": "Home",
  "/app/play": "Play",
  "/app/daily": "Daily",
  "/app/progress": "Progress",
  "/app/account": "Account",
  "/app/play/mystery-box": "Mystery Box",
  "/app/play/map": "Adventure Map",
  "/app/play/prizes": "Prizes",
  "/app/collections": "Collections",
  "/app/wallet": "Wallet",
  "/app/referrals": "Referrals",
  "/app/notifications": "Notifications",
  "/app/account/support": "Support",
};

/**
 * Logical parent for each inner route, matched by prefix pattern (`*` = one segment).
 * Back navigation always goes to this parent, never to browser history.
 */
const PARENTS: [pattern: string, parent: string][] = [
  ["/app/play/mystery-box/history", "/app/play/mystery-box"],
  ["/app/play/mystery-box", "/app/play"],
  ["/app/play/map", "/app/play"],
  ["/app/play/prizes", "/app/play"],
  ["/app/play/vault", "/app/play"],
  ["/app/collections/*", "/app/collections"],
  ["/app/collections", "/app/play"],
  ["/app/wallet/*", "/app/wallet"],
  ["/app/wallet", "/app/account"],
  ["/app/referrals", "/app/account"],
  ["/app/notifications", "/app/account"],
  ["/app/account/support/*", "/app/account/support"],
  ["/app/account/*", "/app/account"],
];

function normalise(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function matches(pattern: string, path: string) {
  const p = pattern.split("/");
  const s = path.split("/");
  if (p.length !== s.length) return false;
  return p.every((seg, i) => seg === "*" || seg === s[i]);
}

export function isRootRoute(pathname: string): pathname is RootRoute {
  return (ROOT_ROUTES as readonly string[]).includes(normalise(pathname));
}

/** Parent route for an inner page. Unknown deeper routes fall back to their nearest ancestor under /app. */
export function parentRoute(pathname: string): string {
  const path = normalise(pathname);
  const hit = PARENTS.find(([pattern]) => matches(pattern, path));
  if (hit) return hit[1];
  const up = path.split("/").slice(0, -1).join("/");
  return up.startsWith("/app") && up.length >= 4 ? up : "/app";
}

/** The bottom-nav section a page belongs to, found by walking up its parent chain. */
export function rootSection(pathname: string): RootRoute {
  let path = normalise(pathname);
  if (!path.startsWith("/app")) return "/app";
  for (let i = 0; i < 10 && !isRootRoute(path); i++) path = parentRoute(path);
  return isRootRoute(path) ? path : "/app";
}

export function routeLabel(pathname: string) {
  return LABELS[normalise(pathname)] ?? null;
}
