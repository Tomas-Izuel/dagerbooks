import fs from "node:fs";
import path from "node:path";
import * as z from "zod";
import { loadCatalog } from "../lib/catalog/load";
import { BooksFileSchema, TopicsFileSchema, UpdatesFileSchema } from "../lib/catalog/schema";

const dir = path.join(process.cwd(), "content");
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const books = z.toJSONSchema(BooksFileSchema, { io: "input" }) as Json;
// Autocompletado de temas desde topics.yaml
const { topics } = loadCatalog();
books.items.properties.topics.items = { type: "string", enum: topics.map((t) => t.id) };

const bookIds = () => loadCatalog().books.map((b) => b.id);
const write = (name: string, schema: Json) =>
  fs.writeFileSync(path.join(dir, name), JSON.stringify(schema, null, 2) + "\n");
write("books.schema.json", books);
// Autocompletado de ids de libros en `books`
const updates = z.toJSONSchema(UpdatesFileSchema, { io: "input" }) as Json;
updates.items.properties.books.items = { type: "string", enum: bookIds() };
write("updates.schema.json", updates);
write("topics.schema.json", z.toJSONSchema(TopicsFileSchema, { io: "input" }) as Json);
console.log("Generados content/*.schema.json");
