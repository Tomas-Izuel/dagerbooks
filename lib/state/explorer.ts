import type { Recommendation } from "@/lib/catalog/schema";
import { ALL_RECS, parseRec, serializeRec } from "@/lib/design/recommendation";
import { buildAdjacency, reach, withImplicitRootEdges, type Adjacency } from "@/lib/catalog/graph";

/** Estado de vista del explorador, serializado en `?libro=&tema=&rec=&q=`. */
export interface ExplorerState {
  libro: string | null;
  tema: string | null;
  /** Niveles de recomendación activos (nunca vacío; los tres = sin filtro). */
  rec: Recommendation[];
  q: string;
}

export const EMPTY_STATE: ExplorerState = { libro: null, tema: null, rec: [...ALL_RECS], q: "" };

/** Subconjunto mínimo de Book que necesita el cliente (serializable). */
export interface ExplorerNode {
  id: string;
  leadsTo?: readonly string[];
  topics: readonly string[];
  /** 0 = raíz; los de nivel 1 cuelgan implícitamente de ella. */
  level: number;
  recommendation: Recommendation;
}

export interface ReadonlyParams {
  get(name: string): string | null;
}

export function parseExplorerState(
  params: ReadonlyParams,
  valid?: { bookIds?: ReadonlySet<string>; topicIds?: ReadonlySet<string> },
): ExplorerState {
  const libro = params.get("libro");
  const tema = params.get("tema");
  return {
    libro: libro && (!valid?.bookIds || valid.bookIds.has(libro)) ? libro : null,
    tema: tema && (!valid?.topicIds || valid.topicIds.has(tema)) ? tema : null,
    rec: parseRec(params.get("rec")),
    q: (params.get("q") ?? "").slice(0, 100),
  };
}

/** Conserva parámetros ajenos al explorador; omite los vacíos. */
export function buildExplorerSearch(state: ExplorerState, base?: URLSearchParams | string): string {
  const p = new URLSearchParams(base ?? "");
  const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
  set("libro", state.libro);
  set("tema", state.tema);
  set("rec", serializeRec(state.rec));
  set("q", state.q.trim() ? state.q : null);
  return p.toString();
}

export interface ExplorerGraph {
  adj: Adjacency;
  byId: ReadonlyMap<string, ExplorerNode>;
}

export function createExplorerGraph(nodes: readonly ExplorerNode[]): ExplorerGraph {
  return { adj: buildAdjacency(withImplicitRootEdges(nodes)), byId: new Map(nodes.map((n) => [n.id, n])) };
}

export interface Selection {
  id: string;
  /** Prerrequisitos transitivos (hacia el centro), sin incluir el libro. */
  prerequisites: ReadonlySet<string>;
  /** Todo lo que desbloquea hacia afuera, sin incluir el libro. */
  unlocks: ReadonlySet<string>;
  /** id + prerequisites + unlocks: lo que queda resaltado. */
  highlighted: ReadonlySet<string>;
}

// La cadena usa las aristas raíz implícitas (withImplicitRootEdges): todo libro de nivel 1 cuelga de la raíz.
export function deriveSelection(graph: ExplorerGraph, id: string | null): Selection | null {
  if (!id || !graph.byId.has(id)) return null;
  const prerequisites = reach(id, graph.adj.in);
  const unlocks = reach(id, graph.adj.out);
  return { id, prerequisites, unlocks, highlighted: new Set([id, ...prerequisites, ...unlocks]) };
}

/**
 * Ids atenuados por el filtro de tema (no se ocultan). Sin filtro: conjunto vacío.
 * Un libro se mantiene si el tema está entre sus temas (primario o secundario);
 * la raíz (sin temas) nunca se atenúa.
 */
export function dimmedByTopic(nodes: readonly ExplorerNode[], tema: string | null): ReadonlySet<string> {
  if (!tema) return new Set();
  return new Set(nodes.filter((n) => n.topics.length > 0 && !n.topics.includes(tema)).map((n) => n.id));
}

/** Ids atenuados por el nivel de recomendación. Con los tres niveles: conjunto vacío. La raíz nunca se atenúa. */
export function dimmedByRecommendation(nodes: readonly ExplorerNode[], rec: readonly Recommendation[]): ReadonlySet<string> {
  if (rec.length >= ALL_RECS.length) return new Set();
  return new Set(nodes.filter((n) => n.topics.length > 0 && !rec.includes(n.recommendation)).map((n) => n.id));
}

/** Intersección: un libro está activo si cumple tema ∧ recomendación; el resto se atenúa. */
export function dimmedByFilters(
  nodes: readonly ExplorerNode[],
  tema: string | null,
  rec: readonly Recommendation[],
): ReadonlySet<string> {
  const a = dimmedByTopic(nodes, tema);
  const b = dimmedByRecommendation(nodes, rec);
  if (a.size === 0) return b;
  if (b.size === 0) return a;
  return new Set([...a, ...b]);
}
