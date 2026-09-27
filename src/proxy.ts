import { NextResponse, type NextRequest } from "next/server";

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
 * - bounces obviously signed-out visitors away from /app and /admin (real auth is enforced server-side)
 */
export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const isProtected = pathname.startsWith("/app") || pathname.startsWith("/admin");

  if (isProtected && !hasSessionCookie(req) && !process.env.DEMO_AUTO_LOGIN_EMAIL) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
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
