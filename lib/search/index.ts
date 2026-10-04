import Fuse from "fuse.js";
import type { Book, Topic } from "@/lib/catalog/schema";
import { normalize } from "./normalize";

export { normalize } from "./normalize";

/** Documento serializable (JSON puro) que viaja del servidor al cliente. */
export interface SearchDoc {
  id: string;
  /** Texto original para mostrar. */
  title: string;
  titleEs?: string;
  /** Campos ya normalizados (sin acentos, minúsculas). */
  t: string;
  tEs: string;
  authors: string;
  topics: string;
  summary: string;
}

export interface SearchResult {
  id: string;
  /** 0 = mejor coincidencia. */
  score: number;
}

const SUMMARY_MAX = 280;

/** Servidor (build): arma el índice a partir del catálogo. */
export function buildSearchDocs(catalog: { books: readonly Book[]; topics: readonly Topic[] }): SearchDoc[] {
  const topicName = new Map(catalog.topics.map((t) => [t.id, t.name]));
  return catalog.books.map((b) => ({
    id: b.id,
    title: b.title,
    titleEs: b.titleEs,
    t: normalize(b.title),
    tEs: normalize(b.titleEs ?? ""),
    authors: normalize((b.authors ?? []).join(" ")),
    topics: normalize(b.topics.map((id) => topicName.get(id) ?? id).join(" ")),
    summary: normalize((b.summary ?? "").slice(0, SUMMARY_MAX)),
  }));
}

export interface Searcher {
  search(query: string, limit?: number): SearchResult[];
}

/** Cliente: Fuse sobre los documentos. Título pesa más que resumen. */
export function createSearcher(docs: readonly SearchDoc[]): Searcher {
  const fuse = new Fuse(docs as SearchDoc[], {
    keys: [
      { name: "t", weight: 1 },
      { name: "tEs", weight: 0.9 },
      { name: "authors", weight: 0.5 },
      { name: "topics", weight: 0.25 },
      { name: "summary", weight: 0.15 },
    ],
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    ignoreFieldNorm: false,
    minMatchCharLength: 2,
  });
  return {
    search(query, limit = 20) {
      const q = normalize(query);
      if (q.length < 2) return [];
      return fuse
        .search(q, { limit })
        .map((r) => ({ id: r.item.id, score: r.score ?? 0 }));
    },
  };
}
