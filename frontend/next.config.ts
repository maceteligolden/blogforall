import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/dashboard/categories",
        destination: "/dashboard/posts/categories",
        permanent: true,
      },
      {
        source: "/dashboard/scheduled-posts",
        destination: "/dashboard/posts/scheduled",
        permanent: true,
      },
      {
        source: "/dashboard/scheduled-posts/:path*",
        destination: "/dashboard/posts/scheduled/:path*",
        permanent: true,
      },
      {
        source: "/dashboard/blogs",
        destination: "/dashboard/posts",
        permanent: true,
      },
      {
        source: "/dashboard/blogs/:path*",
        destination: "/dashboard/posts/:path*",
        permanent: true,
      },
    ];
  },
  // Disable edge runtime for middleware to avoid import assertion issues
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "5005",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3001",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/uploads/**",
      },
    ],
    unoptimized: false,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
