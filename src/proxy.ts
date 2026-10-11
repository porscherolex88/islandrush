import { NextResponse, type NextRequest } from "next/server";
import { isAppPath } from "@/lib/app-routes";
import { detectFiatDisplay, FIAT_COOKIE } from "@/lib/fiat-display.shared";

const DEVICE_COOKIE = "lb_did";
const REFERRAL_COOKIE = "lb_ref";
const SESSION_COOKIE_HINTS = ["session_token", "session_data"];

function hasSessionCookie(req: NextRequest) {
  return req.cookies.getAll().some((c) => SESSION_COOKIE_HINTS.some((hint) => c.name.includes(hint)));
}

/**
 * Lightweight edge of the request pipeline:
 * - assigns a first-party device id (used for fraud signals, never for tracking across sites)
 * - remembers referral codes from ?ref= links
 * - bounces signed-out visitors away from the app and /admin to sign in (real auth is enforced server-side)
 */
export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const isProtected = isAppPath(pathname) || pathname === "/admin" || pathname.startsWith("/admin/");

  if (isProtected && !hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
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
