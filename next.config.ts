import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return {
      fallback: [
        { source: "/auth/register", destination: "/api/auth/register" },
        { source: "/auth/login", destination: "/api/auth/login" },
        { source: "/auth/logout", destination: "/api/auth/logout" },
        { source: "/auth/me", destination: "/api/auth/me" },
        { source: "/screening", destination: "/api/screening" },
        { source: "/reservations", destination: "/api/reservations" },
        { source: "/admin/screening", destination: "/api/admin/screening" },
      ],
    };
  },
};

export default nextConfig;
