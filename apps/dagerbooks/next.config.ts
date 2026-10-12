import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los paquetes del monorepo se consumen como TypeScript fuente.
  transpilePackages: ["@estantes/catalog"],
};

export default nextConfig;
