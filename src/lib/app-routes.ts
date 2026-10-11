/** The five bottom-navigation roots. Every other signed-in route is an inner page. */
export const ROOT_ROUTES = ["/home", "/market", "/play", "/collections", "/wallet"] as const;

/** Top-level segments of the signed-in app. Everything under these requires an account. */
export const APP_SECTIONS = ["/home", "/market", "/play", "/collections", "/wallet", "/daily", "/account", "/invite", "/notifications", "/progress"] as const;

export function isAppPath(pathname: string) {
  return APP_SECTIONS.some((s) => pathname === s || pathname.startsWith(`${s}/`));
}

export type RootRoute = (typeof ROOT_ROUTES)[number];

const LABELS: Record<string, string> = {
  "/home": "Home",
  "/market": "Market",
  "/play": "Play",
  "/daily": "Daily",
  "/account": "Account",
  "/account/withdrawal-accounts": "Bank accounts",
  "/play/mystery-box": "Mystery Box",
  "/play/map": "Adventure Map",
  "/play/prizes": "Puzzles & Prizes",
  "/collections": "Collections",
  "/wallet": "Wallet",
  "/invite": "Referrals",
  "/notifications": "Notifications",
  "/account/support": "Support",
};

/**
 * Logical parent for each inner route, matched by prefix pattern (`*` = one segment).
 * Back navigation always goes to this parent, never to browser history.
 */
const PARENTS: [pattern: string, parent: string][] = [
  ["/play/mystery-box/history", "/play/mystery-box"],
  ["/play/*", "/play"],
  ["/daily/*", "/daily"],
  ["/daily", "/home"],
  ["/collections/*", "/collections"],
  ["/progress", "/collections"],
  ["/wallet/*", "/wallet"],
  ["/invite", "/account"],
  ["/notifications", "/home"],
  ["/account/withdrawal-accounts", "/wallet"],
  ["/account/support/*", "/account/support"],
  ["/account/*", "/account"],
  ["/account", "/home"],
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

/** Parent route for an inner page. Unknown deeper routes fall back to their nearest app ancestor. */
export function parentRoute(pathname: string): string {
  const path = normalise(pathname);
  const hit = PARENTS.find(([pattern]) => matches(pattern, path));
  if (hit) return hit[1];
  const up = path.split("/").slice(0, -1).join("/");
  return isAppPath(up) ? up : "/home";
}

/** The bottom-nav section a page belongs to, found by walking up its parent chain. */
export function rootSection(pathname: string): RootRoute {
  let path = normalise(pathname);
  if (!isAppPath(path)) return "/home";
  for (let i = 0; i < 10 && !isRootRoute(path); i++) path = parentRoute(path);
  return isRootRoute(path) ? path : "/home";
}

export function routeLabel(pathname: string) {
  return LABELS[normalise(pathname)] ?? null;
}
