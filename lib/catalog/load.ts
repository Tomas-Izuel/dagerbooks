import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ZodError, ZodType } from "zod";
import { checkInvariants } from "./invariants";
import {
  BookSchema,
  RouteSchema,
  TopicSchema,
  UpdateSchema,
  leadsToId,
  type Book,
  type Gap,
  type MissingField,
  type RawBook,
  type Route,
  type SiteUpdate,
  type Topic,
} from "./schema";

export class CatalogError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Contenido inválido (${problems.length} problema${problems.length === 1 ? "" : "s"}):\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "CatalogError";
  }
}

export interface Catalog {
  books: Book[];
  topics: Topic[];
  /** Actualizaciones del sitio, la más nueva primero. */
  updates: SiteUpdate[];
  /** Rutas de lectura, en el orden del YAML. */
  routes: Route[];
  root: Book;
  warnings: string[];
}

const fmtPath = (p: PropertyKey[]) =>
  p.map((s, i) => (typeof s === "number" ? `[${s}]` : i ? `.${String(s)}` : String(s))).join("") || "(raíz)";

function zodProblems(label: string, err: ZodError): string[] {
  return err.issues.map((i) => `${label} › ${fmtPath(i.path)}: ${i.message}`);
}

function readYaml(file: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new CatalogError([`${path.basename(file)}: no se pudo leer el archivo`]);
  }
  try {
    return parseYaml(text);
  } catch (e) {
    throw new CatalogError([`${path.basename(file)}: YAML inválido: ${(e as Error).message}`]);
  }
}

function parseList<T extends { id: string }>(
  raw: unknown,
  file: string,
  noun: string,
  schema: ZodType,
  problems: string[],
): T[] {
  if (!Array.isArray(raw)) {
    problems.push(`${file}: debe ser una lista de entradas`);
    return [];
  }
  const out: T[] = [];
  raw.forEach((item, idx) => {
    const id =
      item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
        ? (item as { id: string }).id
        : null;
    const label = id ? `${noun} "${id}"` : `${noun} #${idx + 1} (sin id)`;
    const res = schema.safeParse(item);
    if (res.success) out.push(res.data as unknown as T);
    else problems.push(...zodProblems(label, res.error));
  });
  return out;
}

function withConfidence(b: RawBook): Book {
  const missing: MissingField[] = [];
  if (!b.authors?.length) missing.push("authors");
  if (!b.summary) missing.push("summary");
  if (!b.context) missing.push("context");
  if (!b.sources?.length) missing.push("sources");
  const gaps: Record<string, Gap> = {};
  for (const item of b.leadsTo ?? []) if (typeof item !== "string") gaps[item.id] = item.gap;
  return {
    ...b,
    recommendation: b.recommendation ?? "interesante",
    leadsTo: b.leadsTo?.map(leadsToId),
    gaps,
    confidence: b.confidence ?? (missing.length ? "low" : "high"),
    missing,
    primaryTopic: b.topics[0] ?? null,
  };
}

function checkUpdates(updates: SiteUpdate[], bookIds: Set<string>): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const u of updates) {
    const label = `actualización "${u.id}"`;
    if (seen.has(u.id)) problems.push(`${label}: id repetido`);
    seen.add(u.id);
    const own = new Set<string>();
    (u.books ?? []).forEach((id, i) => {
      if (!bookIds.has(id)) problems.push(`${label} › books[${i}]: el libro "${id}" no existe en books.yaml`);
      if (own.has(id)) problems.push(`${label} › books[${i}]: "${id}" está repetido`);
      own.add(id);
    });
  }
  return problems;
}

/** Invariantes de las rutas contra el catálogo: libros, sources, repetidos, primer paso y línea. */
export function checkRoutes(routes: Route[], books: RawBook[], topicIds: Set<string>): string[] {
  const problems: string[] = [];
  const byId = new Map(books.map((b) => [b.id, b]));
  const seenRoutes = new Set<string>();
  for (const r of routes) {
    const label = `ruta "${r.id}"`;
    if (seenRoutes.has(r.id)) problems.push(`${label}: id repetido`);
    seenRoutes.add(r.id);
    if (!topicIds.has(r.line)) problems.push(`${label} › line: el tema "${r.line}" no existe en topics.yaml`);
    const seenBooks = new Set<string>();
    r.steps.forEach((s, i) => {
      const at = `${label} › steps[${i}]`;
      const book = byId.get(s.book);
      if (!book) problems.push(`${at} › book: el libro "${s.book}" no existe en books.yaml`);
      if (seenBooks.has(s.book)) problems.push(`${at} › book: "${s.book}" está repetido en la ruta`);
      seenBooks.add(s.book);
      if (book) {
        const n = book.sources?.length ?? 0;
        if (s.source === undefined && n > 0) {
          problems.push(`${at} › source: falta; "${s.book}" tiene ${n} source${n === 1 ? "" : "s"} (${n === 1 ? "solo el 0" : `0 a ${n - 1}`}) y el paso debe citar una`);
        } else if (s.source !== undefined && s.source >= n) {
          problems.push(
            `${at} › source: ${s.source} está fuera de rango; "${s.book}" tiene ${n} source${n === 1 ? "" : "s"}${n ? ` (0 a ${n - 1})` : ""}`,
          );
        }
      }
      if (i === 0 && s.gap) problems.push(`${at} › gap: el primer paso no puede tener un tramo a pie antes`);
      if (i === 0 && s.optional) problems.push(`${at} › optional: el primer paso no puede ser optativo`);
    });
  }
  return problems;
}

export function loadCatalogFrom(dir: string): Catalog {
  const problems: string[] = [];
  const topics = parseList<Topic>(readYaml(path.join(dir, "topics.yaml")), "topics.yaml", "tema", TopicSchema, problems);
  const raw = parseList<RawBook>(readYaml(path.join(dir, "books.yaml")), "books.yaml", "libro", BookSchema, problems);

  const updates = parseList<SiteUpdate>(readYaml(path.join(dir, "updates.yaml")), "updates.yaml", "actualización", UpdateSchema, problems);

  const routes = parseList<Route>(readYaml(path.join(dir, "routes.yaml")), "routes.yaml", "ruta", RouteSchema, problems);

  const inv = checkInvariants(raw, topics);
  problems.push(...inv.errors);
  problems.push(...checkUpdates(updates, new Set(raw.map((b) => b.id))));
  problems.push(...checkRoutes(routes, raw, new Set(topics.map((t) => t.id))));
  if (problems.length) throw new CatalogError(problems);

  const books = raw.map(withConfidence);
  // Más nueva primero; a igual fecha se respeta el orden del archivo (sort estable).
  updates.sort((a, b) => b.date.localeCompare(a.date));
  return { books, topics, updates, routes, root: books.find((b) => b.level === 0)!, warnings: inv.warnings };
}

let cached: Catalog | undefined;

/** Carga y valida content/*.yaml (memoizado). Lanza CatalogError si hay problemas. */
export function loadCatalog(): Catalog {
  return (cached ??= loadCatalogFrom(path.join(process.cwd(), "content")));
}
