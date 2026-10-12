import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  // Los paquetes del monorepo se consumen como TypeScript fuente.
  transpilePackages: ["@estantes/catalog", "@estantes/kit"],
};

export default withBotId(nextConfig);
