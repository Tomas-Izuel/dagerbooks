import path from "node:path";
import type { CatalogOf } from "@estantes/catalog";
import { createLoader, loadCatalogFrom as loadFrom } from "@estantes/catalog/node";
import { catalog } from "@/catalog";

export { CatalogError } from "@estantes/catalog/node";

export type Catalog = CatalogOf<typeof catalog>;

/** Carga y valida una carpeta de contenido con el modelo de Dager. Lanza CatalogError si hay problemas. */
export const loadCatalogFrom = (dir: string): Catalog => loadFrom(catalog, dir);

const loader = createLoader(catalog, { dir: path.join(process.cwd(), "content") });

/** Carga y valida content/ (memoizado). Lanza CatalogError si hay problemas. */
export const loadCatalog = (): Catalog => loader.load();
