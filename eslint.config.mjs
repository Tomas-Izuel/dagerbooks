import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".claude/**", "scripts/**/*.cjs", ".next/**", "out/**", "research/**", "next-env.d.ts"]),
]);
