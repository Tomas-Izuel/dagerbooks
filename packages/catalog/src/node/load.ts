import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ZodError, ZodType } from "zod";
import { checkCore, deriveBook } from "../core";
import type { CatalogDef, CatalogOf, ContentLayout, RawBook, Topic } from "../define";
import { checkProgression } from "../modules/progression";
import { checkRoutes, type Route } from "../modules/routes";
import { checkUpdates, sortUpdates, type SiteUpdate } from "../modules/updates";
import { Reporter, type Noun } from "../report";

export class CatalogError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Contenido inválido (${problems.length} problema${problems.length === 1 ? "" : "s"}):\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "CatalogError";
  }
}

const fmtPath = (p: PropertyKey[]) =>
  p.map((s, i) => (typeof s === "number" ? `[${s}]` : i ? `.${String(s)}` : String(s))).join("") || "(raíz)";

const zodProblems = (label: string, err: ZodError) => err.issues.map((i) => `${label} › ${fmtPath(i.path)}: ${i.message}`);

function readYaml(file: string, shown: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new CatalogError([`${shown}: no se pudo leer el archivo`]);
  }
  try {
    return parseYaml(text);
  } catch (e) {
    throw new CatalogError([`${shown}: YAML inválido: ${(e as Error).message}`]);
  }
}

const idOf = (item: unknown) =>
  item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : null;

function validate<T>(item: unknown, label: string, schema: ZodType, problems: string[]): T | null {
  const res = schema.safeParse(item);
  if (res.success) return res.data as T;
  problems.push(...zodProblems(label, res.error));
  return null;
}

function parseList<T>(raw: unknown, file: string, noun: Noun, schema: ZodType, problems: string[]): T[] {
  if (!Array.isArray(raw)) {
    problems.push(`${file}: debe ser una lista de entradas`);
    return [];
  }
  return raw.flatMap((item, idx) => {
    const id = idOf(item);
    const parsed = validate<T>(item, id ? `${noun} "${id}"` : `${noun} #${idx + 1} (sin id)`, schema, problems);
    return parsed ? [parsed] : [];
  });
}

/** Carpeta con un archivo por entrada: el id tiene que coincidir con el nombre del archivo. */
function parseDir<T>(root: string, dir: string, noun: Noun, schema: ZodType, problems: string[]): T[] {
  const full = path.join(root, dir);
  let names: string[];
  try {
    names = fs.readdirSync(full).filter((n) => n.endsWith(".yaml")).sort();
  } catch {
    throw new CatalogError([`${dir}/: no se pudo leer la carpeta`]);
  }
  return names.flatMap((name) => {
    const shown = `${dir}/${name}`;
    const raw = readYaml(path.join(full, name), shown);
    if (Array.isArray(raw) || !raw || typeof raw !== "object") {
      problems.push(`${shown}: debe tener una sola entrada (un objeto), no una lista`);
      return [];
    }
    const id = idOf(raw);
    const stem = name.slice(0, -".yaml".length);
    if (id && id !== stem) problems.push(`${noun} "${id}" › id: no coincide con el nombre del archivo (${name})`);
    const parsed = validate<T>(raw, id ? `${noun} "${id}"` : `${noun} ${shown} (sin id)`, schema, problems);
    return parsed ? [parsed] : [];
  });
}

function readCollection<T>(root: string, layout: ContentLayout, noun: Noun, item: ZodType, problems: string[]): T[] {
  if ("dir" in layout) return parseDir<T>(root, layout.dir, noun, item, problems);
  return parseList<T>(readYaml(path.join(root, layout.file), layout.file), layout.file, noun, item, problems);
}

/** Con un archivo por libro el orden lo da `seq` (y el id para desempatar). */
const bySeq = (a: RawBook<string>, b: RawBook<string>) =>
  (a.seq ?? Number.POSITIVE_INFINITY) - (b.seq ?? Number.POSITIVE_INFINITY) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function loadCatalogFrom<D extends CatalogDef>(def: D, dir: string): CatalogOf<D> {
  const { modules, schemas, content } = def;
  const problems: string[] = [];
  const topics = parseList<Topic>(readYaml(path.join(dir, "topics.yaml"), "topics.yaml"), "topics.yaml", "tema", schemas.Topic, problems);
  const raw = readCollection<RawBook<string>>(dir, content.books, "libro", schemas.Book, problems);
  if ("dir" in content.books) raw.sort(bySeq);
  const updates = modules.updates
    ? readCollection<SiteUpdate>(dir, content.updates, "actualización", schemas.Update, problems)
    : [];
  const routes = modules.routes
    ? parseList<Route>(readYaml(path.join(dir, "routes.yaml"), "routes.yaml"), "routes.yaml", "ruta", schemas.Route, problems)
    : [];

  const r = new Reporter();
  checkCore(raw, topics, r);
  if (modules.progression) checkProgression(raw, r);
  if (modules.updates) checkUpdates(updates, new Set(raw.map((b) => b.id)), r);
  if (modules.routes) checkRoutes(routes, raw, new Set(topics.map((t) => t.id)), r);
  problems.push(...r.errors);
  if (problems.length) throw new CatalogError(problems);

  const books = raw.map((b) => deriveBook(b, def));
  const catalog: Record<string, unknown> = { books, topics };
  if (modules.updates) catalog.updates = sortUpdates(updates);
  if (modules.routes) catalog.routes = routes;
  if (modules.progression) catalog.root = books.find((b) => b.level === 0)!;
  catalog.warnings = r.warnings;
  return catalog as CatalogOf<D>;
}

/** Loader memoizado sobre `<cwd>/content` (o la carpeta que se pase). */
export function createLoader<D extends CatalogDef>(def: D, opts: { dir?: string } = {}) {
  let cached: CatalogOf<D> | undefined;
  const dir = opts.dir ?? path.join(process.cwd(), "content");
  return {
    dir,
    load: (): CatalogOf<D> => (cached ??= loadCatalogFrom(def, dir)),
  };
}
