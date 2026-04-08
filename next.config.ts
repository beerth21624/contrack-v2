import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons", "lucide-react"],
  },
};

export default nextConfig;
