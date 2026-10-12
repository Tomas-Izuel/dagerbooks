/**
 * Open Library: obra (año, tapa), ediciones con ISBN por idioma y título de la edición en español.
 * Port de research/work/verify.py + pick.py: caché URL → JSON en disco y 0,35 s entre pedidos.
 */
import fs from "node:fs";
import path from "node:path";

const UA = { "User-Agent": "estantes-pipeline/0.1 (catalog enrichment)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OpenLibrary {
  private cache: Record<string, unknown>;
  constructor(private readonly cacheFile: string) {
    this.cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
  }

  private save() {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache));
  }

  async get<T>(url: string, tries = 3): Promise<T | null> {
    if (url in this.cache) return this.cache[url] as T | null;
    for (let i = 0; i < tries; i++) {
      await sleep(350);
      try {
        const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25_000) });
        if (res.status === 404) {
          this.cache[url] = null;
          this.save();
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        this.cache[url] = data;
        this.save();
        return data;
      } catch {
        await sleep(2000 * (i + 1));
      }
    }
    return null;
  }

  async search(title: string, author: string | undefined) {
    const q = new URLSearchParams({
      title,
      ...(author ? { author } : {}),
      fields: "key,title,author_name,first_publish_year,isbn,language,cover_i,edition_count",
      limit: "8",
    });
    const d = await this.get<{ docs?: OlDoc[] }>(`https://openlibrary.org/search.json?${q}`);
    return (d?.docs ?? []).filter((x) => titleOk(title, x.title ?? "") && (!author || authorOk(author, x.author_name)));
  }

  async editions(workKey: string): Promise<OlEdition[]> {
    const d = await this.get<{ entries?: RawEdition[] }>(`https://openlibrary.org${workKey}/editions.json?limit=100`);
    return (d?.entries ?? []).map((e) => ({
      title: e.title,
      isbn13: e.isbn_13 ?? [],
      langs: (e.languages ?? []).map((l) => l.key.split("/").pop()!),
      date: e.publish_date,
      publishers: e.publishers ?? [],
    }));
  }

  /** Título de la edición si el ISBN existe en Open Library. */
  async resolveIsbn(isbn: string): Promise<string | null> {
    const d = await this.get<{ title?: string }>(`https://openlibrary.org/isbn/${isbn}.json`);
    return d?.title ?? null;
  }
}

interface OlDoc {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
}
interface RawEdition {
  title?: string;
  isbn_13?: string[];
  languages?: { key: string }[];
  publish_date?: string;
  publishers?: string[];
}
export interface OlEdition {
  title?: string;
  isbn13: string[];
  langs: string[];
  date?: string;
  publishers: string[];
}

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ");

/** Todas las palabras de la consulta están en el título candidato. */
export function titleOk(query: string, candidate: string): boolean {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
  const c = norm(candidate);
  const cw = c.split(/\s+/);
  return words.length > 0 && words.every((w) => cw.includes(w) || c.includes(w));
}

/** El apellido de la consulta aparece en alguno de los autores. */
export function authorOk(query: string, names: readonly string[] | undefined): boolean {
  const last = norm(query).split(/\s+/).filter(Boolean).slice(-1);
  return (names ?? []).some((n) => last.every((w) => norm(n).includes(w)));
}

/** ISO 639-1 (config) → código de Open Library. */
export const OL_LANG: Record<string, string> = { es: "spa", en: "eng", pt: "por", fr: "fre", de: "ger", it: "ita" };

/** Elige una edición con ISBN resoluble, por idioma preferido; prioriza títulos que contienen la consulta. */
export async function pickEdition(ol: OpenLibrary, editions: OlEdition[], langs: string[], words: string) {
  for (const lang of langs) {
    const c = editions
      .filter((e) => e.isbn13.length && e.langs.includes(lang))
      .sort((a, b) => Number(!titleOk(words, a.title ?? "")) - Number(!titleOk(words, b.title ?? "")) || (a.date ?? "").localeCompare(b.date ?? ""));
    for (const e of c.slice(0, 4)) {
      const t = await ol.resolveIsbn(e.isbn13[0]);
      if (t) return { isbn: e.isbn13[0], title: t, lang, publisher: e.publishers[0] };
    }
  }
  return null;
}
