/** `pnpm validate` y `pnpm schema`: la CLI del catálogo con el modelo de Dager. */
import { runCli } from "@estantes/catalog/node";
import { catalog } from "../catalog";

process.exit(runCli(catalog));
