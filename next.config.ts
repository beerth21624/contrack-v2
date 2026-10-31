import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl without i18n routing: the locale comes from the NEXT_LOCALE cookie (src/i18n/request.ts).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// /api/* is proxied to the backend by src/app/api/[...path]/route.ts, which reads API_URL at request time (a rewrite
// here would bake the address into the build). `standalone` keeps the Docker image small (Dockerfile.web).
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons", "lucide-react"],
  },
};

export default withNextIntl(nextConfig);
