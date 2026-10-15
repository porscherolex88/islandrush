import { NextResponse, type NextRequest } from "next/server";
import { isAppPath } from "@/lib/app-routes";
import { detectFiatDisplay, FIAT_COOKIE } from "@/lib/fiat-display.shared";

const DEVICE_COOKIE = "lb_did";
const REFERRAL_COOKIE = "lb_ref";
const ADMIN_SESSION_COOKIE = "lb_admin_session";
const PLAYER_SESSION_HINTS = ["session_token", "session_data"];

function hasPlayerSession(req: NextRequest) {
  return req.cookies.getAll().some((c) => PLAYER_SESSION_HINTS.some((hint) => c.name.includes(hint)));
}

function hasAdminSession(req: NextRequest) {
  return Boolean(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

/**
 * Lightweight edge of the request pipeline:
 * - assigns a first-party device id
 * - remembers referral codes from ?ref= links
 * - player app requires Neon Auth session
 * - /admin/* (except login) requires the separate staff admin session cookie
 */
export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const isAdminLogin = pathname === "/admin/login" || pathname === "/admin/change-password";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPlayerApp = isAppPath(pathname);

  if (isAdmin && !isAdminLogin && !hasAdminSession(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (isPlayerApp && !hasPlayerSession(req)) {
    const url = req.nextUrl.clone();
    url.pathname = isAdmin ? "/admin/login" : "/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (!req.cookies.get(DEVICE_COOKIE)) {
    res.cookies.set(DEVICE_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 2,
      path: "/",
    });
  }
  if (!req.cookies.get(FIAT_COOKIE)) {
    const fiat = detectFiatDisplay({
      cookie: null,
      country: req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry"),
      acceptLanguage: req.headers.get("accept-language"),
    });
    res.cookies.set(FIAT_COOKIE, fiat, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  const ref = searchParams.get("ref");
  if (ref && /^[A-Z0-9]{6,12}$/i.test(ref)) {
    res.cookies.set(REFERRAL_COOKIE, ref.toUpperCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
