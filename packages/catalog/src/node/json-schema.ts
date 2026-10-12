/**
 * JSON Schema para el editor (autocompletado y validación al tipear). Solo se generan los de los
 * módulos activos; los campos que referencian otras entidades se completan con los ids reales.
 */
import fs from "node:fs";
import path from "node:path";
import * as z from "zod";
import type { CatalogDef, CatalogOf } from "../define";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const toJson = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input" }) as Json;

/** Devuelve { nombre de archivo: schema } según el layout y los módulos de la app. */
export function editorSchemas<D extends CatalogDef>(def: D, catalog: CatalogOf<D>): Record<string, Json> {
  const { schemas, modules, content } = def;
  const parents = new Set(catalog.topics.flatMap((t) => (t.parent ? [t.parent] : [])));
  const leafTopics = catalog.topics.filter((t) => !parents.has(t.id)).map((t) => t.id);
  const bookIds = catalog.books.map((b) => b.id);
  const out: Record<string, Json> = {};

  // Libros: lista en un archivo, u objeto suelto con un archivo por libro.
  if ("dir" in content.books) {
    const book = toJson(schemas.Book);
    book.properties.topics.items = { type: "string", enum: leafTopics };
    out["book.schema.json"] = book;
  } else {
    const books = toJson(schemas.BooksFile);
    books.items.properties.topics.items = { type: "string", enum: leafTopics };
    out["books.schema.json"] = books;
  }

  if (modules.updates) {
    if ("dir" in content.updates) {
      const update = toJson(schemas.Update);
      update.properties.books.items = { type: "string", enum: bookIds };
      out["update.schema.json"] = update;
    } else {
      const updates = toJson(schemas.UpdatesFile);
      updates.items.properties.books.items = { type: "string", enum: bookIds };
      out["updates.schema.json"] = updates;
    }
  }

  if (modules.routes) {
    const routes = toJson(schemas.RoutesFile);
    routes.items.properties.line = { type: "string", enum: catalog.topics.map((t) => t.id) };
    routes.items.properties.steps.items.properties.book = { type: "string", enum: bookIds };
    out["routes.schema.json"] = routes;
  }

  out["topics.schema.json"] = toJson(schemas.TopicsFile);
  return out;
}

const serialize = (schema: Json) => JSON.stringify(schema, null, 2) + "\n";

/** Escribe los schemas en `dir`. Con `check`, no escribe: devuelve los archivos desactualizados. */
export function writeEditorSchemas<D extends CatalogDef>(def: D, catalog: CatalogOf<D>, dir: string, check = false): string[] {
  const stale: string[] = [];
  for (const [name, schema] of Object.entries(editorSchemas(def, catalog))) {
    const file = path.join(dir, name);
    const next = serialize(schema);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (current === next) continue;
    stale.push(name);
    if (!check) fs.writeFileSync(file, next);
  }
  return stale;
}
