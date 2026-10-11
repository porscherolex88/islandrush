import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/app", destination: "/home", permanent: true },
      { source: "/app/referrals", destination: "/invite", permanent: true },
      { source: "/app/progress", destination: "/collections", permanent: true },
      { source: "/app/collections/:slug", destination: "/collections", permanent: true },
      { source: "/app/:path*", destination: "/:path*", permanent: true },
      { source: "/progress", destination: "/collections", permanent: true },
      { source: "/collections/:slug", destination: "/collections", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
