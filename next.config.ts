import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons", "lucide-react"],
  },
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/**/*": ["node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
