/**
 * Parte content/books.yaml en content/books/<id>.yaml (un libro por archivo) y agrega `seq` con el
 * orden actual, que es el que usa el layout para desempatar.
 *
 *   tsx tools/migrations/2026-10-split-books.ts --app apps/dagerbooks [--check]
 *
 * Idempotente: si un archivo ya existe y es idéntico lo saltea; si es distinto, aborta (no pisa
 * ediciones). Con --check no escribe nada y falla si algo cambiaría. Si books.yaml ya no existe,
 * no hay nada que hacer.
 */
import fs from "node:fs";
import path from "node:path";
import { Document, Pair, Scalar, YAMLMap, YAMLSeq, isMap, isScalar, parseDocument } from "yaml";

const args = process.argv.slice(2);
const app = args[args.indexOf("--app") + 1];
const check = args.includes("--check");
if (!app || args.indexOf("--app") < 0) {
  console.error("uso: tsx tools/migrations/2026-10-split-books.ts --app apps/<creador> [--check]");
  process.exit(2);
}

const content = path.resolve(app, "content");
const source = path.join(content, "books.yaml");
const outDir = path.join(content, "books");
const MODELINE = " yaml-language-server: $schema=../book.schema.json";

if (!fs.existsSync(source)) {
  console.log(`${path.relative(process.cwd(), source)} no existe: ya está migrado.`);
  process.exit(0);
}

const doc = parseDocument(fs.readFileSync(source, "utf8"));
if (doc.errors.length) throw new Error(`books.yaml inválido: ${doc.errors[0].message}`);
if (!(doc.contents instanceof YAMLSeq)) throw new Error("books.yaml debe ser una lista");

const seen = new Set<string>();
const dropped: string[] = [];
let written = 0;
let skipped = 0;
const pending: Array<{ file: string; text: string }> = [];

doc.contents.items.forEach((item, i) => {
  if (!isMap(item)) throw new Error(`entrada #${i + 1}: no es un mapa`);
  const id = item.get("id");
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`entrada #${i + 1}: id inválido (${String(id)})`);
  if (seen.has(id)) throw new Error(`id duplicado: ${id}`);
  seen.add(id);
  if (item.commentBefore) dropped.push(`antes de ${id}:${item.commentBefore.split("\n").map((l) => ` ${l.trim()}`).join("")}`);

  // Mismos pares (y estilo de cada valor), con `seq` justo después de `id`.
  const map = new YAMLMap();
  for (const pair of item.items) {
    if (isScalar(pair.key) && pair.key.value === "seq") continue;
    map.items.push(pair);
    if (isScalar(pair.key) && pair.key.value === "id") map.items.push(new Pair(new Scalar("seq"), new Scalar(i)));
  }
  const out = new Document(map);
  out.commentBefore = MODELINE;
  pending.push({ file: path.join(outDir, `${id}.yaml`), text: out.toString({ lineWidth: 0, flowCollectionPadding: false }) });
});

const conflicts = pending.filter((p) => fs.existsSync(p.file) && fs.readFileSync(p.file, "utf8") !== p.text);
if (conflicts.length) {
  console.error(`Abortado: ${conflicts.length} archivo(s) ya existen con otro contenido:`);
  for (const c of conflicts) console.error(`  ${path.relative(process.cwd(), c.file)}`);
  process.exit(1);
}

if (!check) fs.mkdirSync(outDir, { recursive: true });
for (const p of pending) {
  if (fs.existsSync(p.file)) skipped++;
  else {
    written++;
    if (!check) fs.writeFileSync(p.file, p.text);
  }
}

console.log(`${check ? "[check] " : ""}${written} escritos, ${skipped} salteados (${pending.length} libros).`);
if (dropped.length) {
  console.log(`Comentarios descartados (${dropped.length}):`);
  for (const d of dropped) console.log(`  ${d}`);
}
if (check && written) process.exit(1);
