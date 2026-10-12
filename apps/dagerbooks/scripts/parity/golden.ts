/**
 * Golden de validación: rompe una copia del contenido real de a un problema por caso y
 * guarda los mensajes que da el validador. Un refactor del catálogo tiene que dar los mismos,
 * porque son lo que lee quien edita el YAML.
 *
 * Las mutaciones operan sobre los datos parseados; `writeContent` es lo único que conoce el
 * layout de archivos y se actualiza cuando cambia (por ejemplo, un archivo por libro).
 */
import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";
import { CatalogError, loadCatalogFrom } from "../../lib/catalog/load";

type Entry = Record<string, unknown>;
interface Content {
  books: Entry[];
  topics: Entry[];
  updates: Entry[];
  routes: Entry[];
}

const CONTENT_DIR = path.resolve("content");
const WORK_DIR = path.resolve("research/parity/golden-work");
const GOLDEN_FILE = path.resolve("scripts/parity/fixtures/golden.json");

function readContent(): Content {
  const read = (name: string) => parse(fs.readFileSync(path.join(CONTENT_DIR, `${name}.yaml`), "utf8")) as Entry[];
  const booksDir = path.join(CONTENT_DIR, "books");
  const books = fs
    .readdirSync(booksDir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => parse(fs.readFileSync(path.join(booksDir, f), "utf8")) as Entry);
  const dirEntries = (name: string) =>
    fs
      .readdirSync(path.join(CONTENT_DIR, name))
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => parse(fs.readFileSync(path.join(CONTENT_DIR, name, f), "utf8")) as Entry);
  return { books, topics: read("topics"), updates: dirEntries("updates"), routes: read("routes") };
}

function writeContent(dir: string, c: Content, raw: Record<string, string> = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const name of ["topics", "routes"] as const) {
    const file = `${name}.yaml`;
    fs.writeFileSync(path.join(dir, file), raw[file] ?? stringify(c[name], { lineWidth: 0 }));
  }
  // Un archivo por libro y por novedad; si el id no es usable como nombre, el archivo se llama como su posición.
  for (const name of ["books", "updates"] as const) {
    fs.mkdirSync(path.join(dir, name));
    c[name].forEach((e, i) => {
      const stem = typeof e.id === "string" && /^[\w-]+$/.test(e.id) ? e.id : `entrada-${i + 1}`;
      const file = `${name}/${stem}.yaml`;
      const target = fs.existsSync(path.join(dir, file)) ? `${name}/${stem}-${i + 1}.yaml` : file;
      fs.writeFileSync(path.join(dir, target), raw[file] ?? stringify(e, { lineWidth: 0 }));
    });
  }
}

const byId = (list: Entry[], id: string) => {
  const e = list.find((x) => x.id === id);
  if (!e) throw new Error(`golden: no existe "${id}" en el contenido; actualizá el caso`);
  return e;
};

/** Libros estables del catálogo de Dager sobre los que se aplican las mutaciones. */
const ROOT = "tom-sawyer-abroad";
const A = "but-how-do-it-know";
const B = "pro-git";
const U1 = "2026-10-11-rutas";
const U2 = "2026-10-11-stream";

interface Case {
  name: string;
  mutate?: (c: Content) => void;
  raw?: Record<string, string>;
}

const CASES: Case[] = [
  { name: "contenido real (sin cambios)" },
  { name: "libro sin title", mutate: (c) => void delete byId(c.books, A).title },
  { name: "id que no es slug", mutate: (c) => void (byId(c.books, A).id = "Bad Slug") },
  { name: "id duplicado", mutate: (c) => void (byId(c.books, B).id = A) },
  { name: "tema inexistente", mutate: (c) => void (byId(c.books, A).topics = ["no-existe"]) },
  { name: "temas repetidos", mutate: (c) => void (byId(c.books, A).topics = ["fundamentos", "fundamentos"]) },
  { name: "libro sin temas", mutate: (c) => void (byId(c.books, A).topics = []) },
  { name: "level fuera de rango", mutate: (c) => void (byId(c.books, A).level = 7) },
  { name: "level que no es número", mutate: (c) => void (byId(c.books, A).level = "dos") },
  { name: "dos raíces", mutate: (c) => Object.assign(byId(c.books, A), { level: 0, topics: [] }) },
  { name: "campo desconocido", mutate: (c) => void (byId(c.books, A).foo = 1) },
  { name: "asin sin tienda", mutate: (c) => void (byId(c.books, A).asin = "0520271513") },
  { name: "asin inválido", mutate: (c) => void (byId(c.books, A).asin = { es: "123" }) },
  { name: "isbn inválido", mutate: (c) => void (byId(c.books, A).isbn = "12-34") },
  { name: "recommendation inválida", mutate: (c) => void (byId(c.books, A).recommendation = "maso") },
  { name: "kind inválido", mutate: (c) => void (byId(c.books, A).kind = "revista") },
  { name: "source sin url válida", mutate: (c) => void (byId(c.books, A).sources = [{ url: "no-es-url" }]) },
  { name: "leadsTo inexistente", mutate: (c) => void (byId(c.books, A).leadsTo = ["no-existe"]) },
  { name: "leadsTo a sí mismo", mutate: (c) => void (byId(c.books, A).leadsTo = [A]) },
  { name: "leadsTo a nivel menor", mutate: (c) => void (byId(c.books, A).leadsTo = [ROOT]) },
  { name: "leadsTo repetido", mutate: (c) => void (byId(c.books, ROOT).leadsTo = [A, A]) },
  {
    name: "gap con severity inválida",
    mutate: (c) => void (byId(c.books, ROOT).leadsTo = [{ id: A, gap: { severity: "leve", bridge: ["x"] } }]),
  },
  {
    name: "gap sin bridge",
    mutate: (c) => void (byId(c.books, ROOT).leadsTo = [{ id: A, gap: { severity: "fuerte", bridge: [] } }]),
  },
  { name: "related inexistente", mutate: (c) => void (byId(c.books, A).related = [{ id: "no-existe", reason: "x" }]) },
  { name: "related consigo mismo", mutate: (c) => void (byId(c.books, A).related = [{ id: A, reason: "x" }]) },
  { name: "related sin razón", mutate: (c) => void (byId(c.books, A).related = [{ id: B, reason: "" }]) },
  { name: "tema sin description", mutate: (c) => void delete c.topics[0].description },
  { name: "tema duplicado", mutate: (c) => void (c.topics[1].id = c.topics[0].id) },
  { name: "actualización con libro inexistente", mutate: (c) => void (byId(c.updates, U1).books = ["no-existe"]) },
  { name: "actualización con fecha inválida", mutate: (c) => void (byId(c.updates, U1).date = "2026-02-30") },
  { name: "actualización sin improvements", mutate: (c) => void (byId(c.updates, U1).improvements = []) },
  { name: "actualización con id repetido", mutate: (c) => void (byId(c.updates, U2).id = U1) },
  {
    name: "ruta con libro inexistente",
    mutate: (c) => void ((c.routes[0].steps as Entry[])[1].book = "no-existe"),
  },
  { name: "ruta con source fuera de rango", mutate: (c) => void ((c.routes[0].steps as Entry[])[1].source = 99) },
  { name: "ruta con línea inexistente", mutate: (c) => void (c.routes[0].line = "no-existe") },
  { name: "ruta con pocos pasos", mutate: (c) => void (c.routes[0].steps = (c.routes[0].steps as Entry[]).slice(0, 2)) },
  { name: "ruta con primer paso optativo", mutate: (c) => void ((c.routes[0].steps as Entry[])[0].optional = true) },
  { name: "ruta con kind inválido", mutate: (c) => void (c.routes[0].kind = "paseo") },
  { name: "topics.yaml con YAML roto", raw: { "topics.yaml": "- id: [sin cerrar\n" } },
  { name: "libro que es una lista", raw: { "books/pro-git.yaml": "- id: pro-git\n" } },
];

interface Result {
  name: string;
  ok: boolean;
  messages: string[];
  warnings: string[];
}

function runCase(base: Content, k: Case): Result {
  const content = structuredClone(base);
  k.mutate?.(content);
  writeContent(WORK_DIR, content, k.raw);
  try {
    const { warnings } = loadCatalogFrom(WORK_DIR);
    return { name: k.name, ok: true, messages: [], warnings: [...warnings].sort() };
  } catch (e) {
    if (!(e instanceof CatalogError)) throw e;
    return { name: k.name, ok: false, messages: [...e.problems].sort(), warnings: [] };
  }
}

/** Devuelve true si el golden coincide (o si se grabó). */
export function runGolden(record: boolean): boolean {
  const base = readContent();
  const results = CASES.map((k) => runCase(base, k));
  fs.rmSync(WORK_DIR, { recursive: true, force: true });

  const silent = results.filter((r, i) => i > 0 && r.ok);
  if (silent.length) {
    console.error(`golden: ${silent.length} caso(s) no producen error: ${silent.map((r) => r.name).join(", ")}`);
    return false;
  }

  if (record) {
    fs.mkdirSync(path.dirname(GOLDEN_FILE), { recursive: true });
    fs.writeFileSync(GOLDEN_FILE, JSON.stringify(results, null, 2) + "\n");
    console.log(`golden: grabados ${results.length} casos → ${path.relative(process.cwd(), GOLDEN_FILE)}`);
    return true;
  }

  const expected = JSON.parse(fs.readFileSync(GOLDEN_FILE, "utf8")) as Result[];
  const want = new Map(expected.map((r) => [r.name, r]));
  let failures = 0;
  for (const got of results) {
    const exp = want.get(got.name);
    if (!exp) {
      console.error(`golden: caso nuevo sin grabar: ${got.name}`);
      failures++;
      continue;
    }
    if (JSON.stringify(exp) !== JSON.stringify(got)) {
      failures++;
      console.error(`golden: "${got.name}" cambió`);
      const missing = [...exp.messages, ...exp.warnings].filter((m) => ![...got.messages, ...got.warnings].includes(m));
      const extra = [...got.messages, ...got.warnings].filter((m) => ![...exp.messages, ...exp.warnings].includes(m));
      for (const m of missing) console.error(`    - ${m}`);
      for (const m of extra) console.error(`    + ${m}`);
    }
  }
  if (failures) return false;
  console.log(`golden: ${results.length} casos idénticos`);
  return true;
}
