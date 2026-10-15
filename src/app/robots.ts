import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://lootbox-smoky.vercel.app";

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
    sitemap: `${SITE}/sitemap.xml`,
  };
}
