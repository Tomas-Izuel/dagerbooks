/**
 * Pasa `asin: "XXXXXXXXXX"` a `asin: { <tienda>: "XXXXXXXXXX" }` en cada content/books/<id>.yaml,
 * en el mismo lugar del archivo y con el mismo estilo del valor.
 *
 *   tsx tools/migrations/2026-10-asin-marketplace.ts --app apps/dagerbooks --marketplace es [--check]
 *
 * Idempotente: si `asin` ya es un mapa, no toca el archivo. Con --check no escribe y falla si algo cambiaría.
 */
import fs from "node:fs";
import path from "node:path";
import { YAMLMap, isMap, isScalar, parseDocument } from "yaml";

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const app = opt("--app");
const marketplace = opt("--marketplace");
const check = args.includes("--check");
if (!app || !marketplace) {
  console.error("uso: tsx tools/migrations/2026-10-asin-marketplace.ts --app apps/<creador> --marketplace <tienda> [--check]");
  process.exit(2);
}

const dir = path.resolve(app, "content", "books");
let changed = 0;
let already = 0;
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".yaml")).sort()) {
  const file = path.join(dir, name);
  const text = fs.readFileSync(file, "utf8");
  const doc = parseDocument(text);
  if (!isMap(doc.contents)) throw new Error(`${name}: no es un mapa`);
  const pair = doc.contents.items.find((p) => isScalar(p.key) && p.key.value === "asin");
  if (!pair) continue;
  if (isMap(pair.value)) {
    already++;
    continue;
  }
  if (!isScalar(pair.value) || typeof pair.value.value !== "string") throw new Error(`${name}: asin no es un texto ni un mapa`);
  const map = new YAMLMap();
  map.set(marketplace, pair.value);
  pair.value = map;
  changed++;
  if (!check) fs.writeFileSync(file, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
}

console.log(`${check ? "[check] " : ""}${changed} convertidos, ${already} ya tenían tienda.`);
if (check && changed) process.exit(1);
