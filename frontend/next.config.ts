import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/dashboard/categories",
        destination: "/dashboard/blogs/categories",
        permanent: true,
      },
      {
        source: "/dashboard/scheduled-posts",
        destination: "/dashboard/blogs/scheduled",
        permanent: true,
      },
      {
        source: "/dashboard/scheduled-posts/:path*",
        destination: "/dashboard/blogs/scheduled/:path*",
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

export default nextConfig;

