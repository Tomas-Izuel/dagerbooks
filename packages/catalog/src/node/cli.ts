/**
 * CLI del catálogo, la que llama cada app desde su `scripts/catalog.ts`:
 *   validate          valida el contenido e imprime un resumen (exit 1 si hay problemas)
 *   schema [--check]  regenera los JSON Schema del editor (con --check, falla si están desactualizados)
 */
import path from "node:path";
import type { CatalogDef, CatalogOf } from "../define";
import { writeEditorSchemas } from "./json-schema";
import { CatalogError, loadCatalogFrom } from "./load";

export function summary<D extends CatalogDef>(def: D, c: CatalogOf<D>): string {
  const low = c.books.filter((b) => b.confidence === "low").length;
  const parts = [`${c.books.length} libros`, `${c.topics.length} temas`];
  if (def.modules.updates) parts.push(`${c.updates?.length ?? 0} actualizaciones`);
  if (def.modules.routes) parts.push(`${c.routes?.length ?? 0} rutas`);
  parts.push(`${low} por completar`);
  return `OK: ${parts.join(", ")}.`;
}

export function runCli<D extends CatalogDef>(def: D, argv = process.argv.slice(2), dir = path.join(process.cwd(), "content")): number {
  const [cmd, ...flags] = argv;
  let catalog: CatalogOf<D>;
  try {
    catalog = loadCatalogFrom(def, dir);
  } catch (e) {
    if (e instanceof CatalogError) {
      console.error(`\n${e.message}\n`);
      return 1;
    }
    throw e;
  }

  if (cmd === "validate") {
    console.log(summary(def, catalog));
    if (catalog.warnings.length) {
      console.warn(`\nAvisos (${catalog.warnings.length}):`);
      for (const w of catalog.warnings) console.warn(`  - ${w}`);
    }
    return 0;
  }

  if (cmd === "schema") {
    const check = flags.includes("--check");
    const stale = writeEditorSchemas(def, catalog, dir, check);
    if (check && stale.length) {
      console.error(`JSON Schema desactualizados: ${stale.join(", ")}. Corré \`pnpm schema\`.`);
      return 1;
    }
    console.log(check ? "JSON Schema al día." : `Generados ${stale.length ? stale.map((s) => `content/${s}`).join(", ") : "content/*.schema.json (sin cambios)"}`);
    return 0;
  }

  console.error("uso: catalog validate | catalog schema [--check]");
  return 2;
}
