import path from "path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep tracing rooted in `frontend/` so parent lockfiles don't make Next serve the wrong chunks.
  outputFileTracingRoot: path.join(__dirname),
  // Standalone is for Docker/Node deploys. On Netlify it breaks serving of `public/`
  // (including /demos/*), which is why landing screenshots 404 in the Netlify dev env
  // while working locally — see Netlify Next runtime + output:standalone guidance.
  ...(process.env.NETLIFY ? {} : { output: "standalone" as const }),
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
