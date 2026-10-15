import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** Public marketing pages are indexable. Signed-in app and admin stay out of search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/home",
          "/play",
          "/daily",
          "/wallet",
          "/account",
          "/market",
          "/collections",
          "/invite",
          "/notifications",
          "/admin",
          "/api",
          "/login",
          "/register",
          "/forgot-password",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
