import type { NextConfig } from "next";

/** Backend (NestJS) origin. `/api/*` is proxied there so the httpOnly refresh cookie stays same-origin. */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons", "lucide-react"],
  },
  rewrites() {
    return Promise.resolve([{ source: "/api/:path*", destination: `${API_URL}/:path*` }]);
  },
};

export default nextConfig;
