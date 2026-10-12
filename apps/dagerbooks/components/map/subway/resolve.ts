/**
 * Adaptador de la vista Subte: arma la geometría del mapa a partir de lo que la página ya envía
 * (`MapGeometrySet` + `ExplorerNode[]`), sin tocar el servidor. Puro y sin React ni Node:
 * corre dentro del chunk perezoso de `SubwayMap`. Quien lo llame debe memoizar el resultado.
 */
import type { LayoutEdge } from "@/lib/catalog/layout.types";
import { computeSubwayLayout, SUBWAY_DENSITY_PRESETS } from "@/lib/catalog/subway";
import { computeSubwayFocusLayout, type SubwayFocusBook } from "@/lib/catalog/subway-focus";
import type { SubwayBook, SubwayCatalog, SubwayLayout } from "@/lib/catalog/subway.types";
import type { Density } from "@/lib/density";
import type { ExplorerNode } from "@/lib/state/explorer";
import type { MapGeometrySet, MapNodeMeta } from "../types";
import type { SubwayFocus, SubwayGeometry, SubwayMapNode } from "./types";

/** Catálogo del layout a partir del conjunto de geometría (metadatos de estaciones y aristas). */
export function buildSubwayCatalog(set: MapGeometrySet, topicIds: readonly string[]): SubwayCatalog {
  const leadsTo = new Map<string, string[]>();
  const related = new Map<string, { id: string; reason?: string }[]>();
  for (const e of set.edges) {
    if (e.kind === "leadsTo") (leadsTo.get(e.from) ?? leadsTo.set(e.from, []).get(e.from)!).push(e.to);
    else if (e.kind === "related") {
      (related.get(e.from) ?? related.set(e.from, []).get(e.from)!).push({ id: e.to, reason: e.reason });
    }
  }
  const books: SubwayBook[] = set.nodes.map((n) => ({
    id: n.id,
    level: n.level,
    primaryTopic: n.topicId,
    leadsTo: leadsTo.get(n.id),
    related: related.get(n.id),
    title: n.title,
    recommendation: n.recommendation,
    entry: n.entry,
  }));
  return { books, topics: topicIds.map((id) => ({ id })) };
}

function toGeometry(layout: SubwayLayout, meta: ReadonlyMap<string, MapNodeMeta>, focusTopic: string | null): SubwayGeometry {
  const nodes: SubwayMapNode[] = [];
  for (const p of layout.nodes) {
    const m = meta.get(p.id);
    if (!m) continue;
    nodes.push({
      ...m,
      // En foco toda estación lleva la tinta de la línea, aunque su línea primaria sea otra.
      topicId: focusTopic === null ? m.topicId : m.level === 0 ? null : focusTopic,
      entry: focusTopic === null ? m.entry : m.entry && m.topicId === focusTopic,
      x: p.x,
      y: p.y,
      angle: 0,
      r: p.x,
      band: p.band,
      lane: p.lane,
      sub: p.sub,
      role: p.role,
      labelSlot: p.labelSlot,
      rank: p.rank,
    });
  }
  return { nodes, edges: layout.edges, bands: layout.bands, zones: layout.zones, pill: layout.pill, bounds: layout.bounds };
}

const metaOf = (set: MapGeometrySet) => new Map(set.nodes.map((n) => [n.id, n]));

/** Mapa completo: una banda por línea, en el orden de `lines`. Las aristas salen en el orden de `set.edges`. */
export function resolveSubway(set: MapGeometrySet, topicIds: readonly string[], density: Density): SubwayGeometry {
  const layout = computeSubwayLayout(buildSubwayCatalog(set, topicIds), SUBWAY_DENSITY_PRESETS[density]);
  const geometry = toGeometry(layout, metaOf(set), null);
  // Mismo orden de aristas que el conjunto, así `edges[i]` corresponde a `set.edges[i]`.
  const byKey = new Map<string, LayoutEdge>(layout.edges.map((e) => [`${e.kind}|${e.from}|${e.to}`, e]));
  const edges: LayoutEdge[] = [];
  for (const e of set.edges) {
    const hit = byKey.get(`${e.kind}|${e.from}|${e.to}`);
    if (hit) edges.push(hit);
  }
  return { ...geometry, edges };
}

/** Foco por línea: una sola banda con los libros que tienen la línea en `topics`, más Km 0. */
export function resolveSubwayFocus(
  set: MapGeometrySet,
  explorerNodes: readonly ExplorerNode[],
  topicId: string,
  density: Density,
): SubwayFocus {
  const meta = metaOf(set);
  const books: SubwayFocusBook[] = explorerNodes.map((n) => ({
    id: n.id,
    level: n.level,
    topics: n.topics,
    leadsTo: n.leadsTo,
    title: meta.get(n.id)?.title,
    recommendation: n.recommendation,
  }));
  const related = set.edges.filter((e) => e.kind === "related");
  const focus = computeSubwayFocusLayout(books, related, topicId, SUBWAY_DENSITY_PRESETS[density]);
  return { topicId, geometry: toGeometry(focus.layout, meta, topicId), count: focus.count, links: focus.links };
}
