"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ALL_RECS, toggleRec } from "@/lib/design/recommendation";
import type { Recommendation } from "@/lib/catalog/schema";
import type { Vista } from "@/lib/view";
import {
  buildExplorerSearch,
  createExplorerGraph,
  deriveSelection,
  dimmedByFilters,
  focusTopicFor,
  parseExplorerState,
  reconcileFocus,
  type ExplorerNode,
  type ExplorerState,
  type Selection,
} from "@/lib/state/explorer";

export interface UseExplorerState {
  state: ExplorerState;
  /** Selección con cadena de prerrequisitos y desbloqueos (null si no hay libro). */
  selection: Selection | null;
  /** Ids atenuados por tema ∧ recomendación (intersección). */
  dimmed: ReadonlySet<string>;
  /** push: cada libro seleccionado es una entrada de historial. Con una línea en foco, un libro ajeno a ella pasa el foco a su línea. */
  selectBook: (id: string | null) => void;
  /** replace: cambiar filtro no ensucia el historial. */
  setTopic: (id: string | null) => void;
  /** Alterna un nivel de recomendación (ver toggleRec: aísla, alterna, nunca queda en cero). */
  toggleRecommendation: (r: Recommendation) => void;
  resetRecommendation: () => void;
  /** replace: cambiar de vista no ensucia el historial; conserva libro, tema, rec y q. */
  setVista: (v: Vista) => void;
  /** replace: seguro para teclear. */
  setQuery: (q: string) => void;
  reset: () => void;
}

/** Requiere un <Suspense> ancestro (useSearchParams) en la página que lo use. */
export function useExplorerState(nodes: readonly ExplorerNode[], topicIds?: readonly string[]): UseExplorerState {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const graph = useMemo(() => createExplorerGraph(nodes), [nodes]);
  const topicSet = useMemo(() => (topicIds ? new Set(topicIds) : undefined), [topicIds]);
  const urlState = useMemo(
    () => reconcileFocus(parseExplorerState(params, { bookIds: new Set(graph.byId.keys()), topicIds: topicSet }), graph.byId),
    [params, graph, topicSet],
  );

  // `q` se mantiene local para que el input no dependa de la latencia del router;
  // se resincroniza cuando cambia el valor en la URL (atrás/adelante).
  const [typed, setTyped] = useState<{ from: string; value: string }>({ from: urlState.q, value: urlState.q });
  const q = typed.from === urlState.q ? typed.value : urlState.q;
  const state = useMemo(() => ({ ...urlState, q }), [urlState, q]);

  const navigate = useCallback(
    (next: ExplorerState, mode: "push" | "replace") => {
      const search = buildExplorerSearch(next, params.toString());
      const href = search ? `${pathname}?${search}` : pathname;
      router[mode](href, { scroll: false });
    },
    [params, pathname, router],
  );

  // With a line in focus, picking a book of another line moves the focus to that book's line.
  const selectBook = useCallback(
    (libro: string | null) =>
      navigate({ ...state, libro, tema: libro ? focusTopicFor(graph.byId.get(libro), state.tema) : state.tema }, "push"),
    [navigate, state, graph],
  );
  const setTopic = useCallback((tema: string | null) => navigate({ ...state, tema }, "replace"), [navigate, state]);
  const toggleRecommendation = useCallback(
    (r: Recommendation) => navigate({ ...state, rec: toggleRec(state.rec, r) }, "replace"),
    [navigate, state],
  );
  const resetRecommendation = useCallback(() => navigate({ ...state, rec: [...ALL_RECS] }, "replace"), [navigate, state]);
  const setVista = useCallback((vista: Vista) => navigate({ ...state, vista }, "replace"), [navigate, state]);
  const setQuery = useCallback(
    (value: string) => {
      setTyped({ from: urlState.q, value });
      navigate({ ...state, q: value }, "replace");
    },
    [navigate, state, urlState.q],
  );
  const reset = useCallback(() => {
    setTyped({ from: urlState.q, value: "" });
    navigate({ libro: null, tema: null, rec: [...ALL_RECS], q: "", vista: state.vista }, "replace");
  }, [navigate, urlState.q, state.vista]);

  const selection = useMemo(() => deriveSelection(graph, state.libro), [graph, state.libro]);
  const dimmed = useMemo(() => dimmedByFilters(nodes, state.tema, state.rec), [nodes, state.tema, state.rec]);

  return { state, selection, dimmed, selectBook, setTopic, toggleRecommendation, resetRecommendation, setVista, setQuery, reset };
}
