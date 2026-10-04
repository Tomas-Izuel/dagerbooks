import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ZodError } from "zod";
import { checkInvariants } from "./invariants";
import {
  BookSchema,
  TopicSchema,
  type Book,
  type MissingField,
  type RawBook,
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
  schema: typeof BookSchema | typeof TopicSchema,
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
  return {
    ...b,
    confidence: b.confidence ?? (missing.length ? "low" : "high"),
    missing,
    primaryTopic: b.topics[0] ?? null,
  };
}

export function loadCatalogFrom(dir: string): Catalog {
  const problems: string[] = [];
  const topics = parseList<Topic>(readYaml(path.join(dir, "topics.yaml")), "topics.yaml", "tema", TopicSchema, problems);
  const raw = parseList<RawBook>(readYaml(path.join(dir, "books.yaml")), "books.yaml", "libro", BookSchema, problems);

  const inv = checkInvariants(raw, topics);
  problems.push(...inv.errors);
  if (problems.length) throw new CatalogError(problems);

  const books = raw.map(withConfidence);
  return { books, topics, root: books.find((b) => b.level === 0)!, warnings: inv.warnings };
}

let cached: Catalog | undefined;

/** Carga y valida content/*.yaml (memoizado). Lanza CatalogError si hay problemas. */
export function loadCatalog(): Catalog {
  return (cached ??= loadCatalogFrom(path.join(process.cwd(), "content")));
}
