/**
 * Lectura y escritura de content/books/<id>.yaml conservando el estilo de cada archivo
 * (comillas, listas en línea). Los libros nuevos siguen el orden de campos del catálogo.
 */
import fs from "node:fs";
import path from "node:path";
import { Document, YAMLMap, YAMLSeq, isMap, isScalar, isSeq, parseDocument, type Node } from "yaml";

export const MODELINE = " yaml-language-server: $schema=../book.schema.json";

/** Orden de campos de un libro, como en los archivos existentes. */
export const FIELD_ORDER = [
  "id",
  "seq",
  "title",
  "titleEs",
  "authors",
  "year",
  "kind",
  "topics",
  "level",
  "recommendation",
  "summary",
  "context",
  "sources",
  "leadsTo",
  "related",
  "isbn",
  "asin",
  "coverId",
  "confidence",
] as const;

const STRING_STYLE = "QUOTE_DOUBLE" as const;

export const booksDir = (contentDir: string) => path.join(contentDir, "books");
export const bookFile = (contentDir: string, id: string) => path.join(booksDir(contentDir), `${id}.yaml`);

export function readBookDoc(file: string): Document.Parsed {
  const doc = parseDocument(fs.readFileSync(file, "utf8"));
  if (doc.errors.length) throw new Error(`${file}: ${doc.errors[0].message}`);
  if (!isMap(doc.contents)) throw new Error(`${file}: no es un mapa`);
  return doc;
}

export const writeDoc = (file: string, doc: Document) =>
  fs.writeFileSync(file, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));

/** Mayor `seq` del catálogo (−1 si no hay). */
export function maxSeq(contentDir: string): number {
  let max = -1;
  const dir = booksDir(contentDir);
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".yaml"))) {
    const seq = readBookDoc(path.join(dir, name)).get("seq");
    if (typeof seq === "number" && seq > max) max = seq;
  }
  return max;
}

/** Nodo con el estilo de la casa: textos entre comillas dobles, listas cortas de textos en línea. */
function styled(doc: Document, key: string, value: unknown): Node {
  const node = doc.createNode(value) as Node;
  const quote = (n: unknown) => {
    if (isScalar(n) && typeof n.value === "string") n.type = STRING_STYLE;
    else if (isSeq(n) || isMap(n)) for (const item of (n as YAMLSeq | YAMLMap).items) quote(isMap(n) ? (item as { value: unknown }).value : item);
  };
  // ids y enums sin comillas, como en el catálogo
  if (!["id", "kind", "recommendation", "confidence", "level", "seq", "coverId", "year"].includes(key)) quote(node);
  if (isSeq(node) && node.items.every((i) => isScalar(i)) && ["authors", "topics", "leadsTo"].includes(key)) node.flow = true;
  return node;
}

/** Archivo nuevo para un libro (los campos ausentes se omiten). */
export function newBookDoc(book: Record<string, unknown>): Document {
  const doc = new Document(new YAMLMap());
  const map = doc.contents as YAMLMap;
  const keys = [...FIELD_ORDER, ...Object.keys(book).filter((k) => !(FIELD_ORDER as readonly string[]).includes(k))];
  for (const k of keys) {
    const v = book[k];
    if (v === undefined || v === null || (Array.isArray(v) && !v.length && k !== "topics")) continue;
    map.set(doc.createNode(k), styled(doc, k, v));
  }
  doc.commentBefore = MODELINE;
  return doc;
}

/** Fija un campo respetando el orden de campos: si no existía, lo inserta en su lugar. */
export function setField(doc: Document, key: string, value: unknown) {
  const map = doc.contents as YAMLMap;
  const node = styled(doc, key, value);
  const existing = map.items.find((p) => isScalar(p.key) && p.key.value === key);
  if (existing) {
    existing.value = node;
    return;
  }
  const rank = (k: string) => {
    const i = (FIELD_ORDER as readonly string[]).indexOf(k);
    return i < 0 ? FIELD_ORDER.length : i;
  };
  const at = map.items.findIndex((p) => isScalar(p.key) && rank(String(p.key.value)) > rank(key));
  const pair = doc.createPair(key, null);
  pair.value = node;
  if (at < 0) map.items.push(pair);
  else map.items.splice(at, 0, pair);
}

/** Agrega sources a un libro existente, al final de la lista. */
export function appendSources(doc: Document, sources: Record<string, unknown>[]) {
  if (!sources.length) return;
  const map = doc.contents as YAMLMap;
  const cur = map.get("sources", true);
  if (isSeq(cur)) for (const s of sources) cur.items.push(styled(doc, "sources", s));
  else setField(doc, "sources", sources);
}
