import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Una app no importa otra app ni el código interno de un paquete (solo sus entries públicos).
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["**/apps/*"], message: "Una app no importa otra app: lo compartido va en packages/." }, { group: ["@estantes/*/src/*"], message: "Importá el entry público del paquete." }] },
      ],
    },
  },
  globalIgnores([".claude/**", "scripts/**/*.cjs", ".next/**", "out/**", "research/**", "next-env.d.ts"]),
]);
