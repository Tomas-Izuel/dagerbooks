"use client";

import { useEffect, useMemo, useState } from "react";
import { createSearcher, type SearchDoc, type SearchResult } from "@/lib/search";

export interface UseBookSearch {
  /** Texto del input (sin debounce). */
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  /** Hay consulta efectiva (>= 2 caracteres) y ya se evaluó. */
  active: boolean;
  /** Consulta efectiva sin resultados (para el estado vacío). */
  empty: boolean;
  /** El debounce aún no se aplicó. */
  pending: boolean;
}

export function useBookSearch(docs: readonly SearchDoc[], opts: { initialQuery?: string; delay?: number; limit?: number } = {}): UseBookSearch {
  const { initialQuery = "", delay = 150, limit = 20 } = opts;
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const searcher = useMemo(() => createSearcher(docs), [docs]);

  useEffect(() => {
    if (query === debounced) return;
    const t = setTimeout(() => setDebounced(query), delay);
    return () => clearTimeout(t);
  }, [query, debounced, delay]);

  const results = useMemo(() => searcher.search(debounced, limit), [searcher, debounced, limit]);
  const active = debounced.trim().length >= 2;
  return { query, setQuery, results, active, empty: active && results.length === 0, pending: query !== debounced };
}
