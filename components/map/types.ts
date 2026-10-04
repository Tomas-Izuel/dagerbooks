import type { LayoutBounds, LayoutEdge, LayoutEdgeKind, LayoutRing, LayoutSector } from "@/lib/catalog/layout.types";
import type { Recommendation } from "@/lib/catalog/schema";
import type { FocusLayout } from "@/lib/catalog/focus";
import type { Density } from "@/lib/density";

/** Slim, serializable station for the map (server -> client). */
export interface MapNode {
  id: string;
  title: string;
  titleEs?: string;
  /** Primary topic id (the line); null for Kilómetro 0. */
  topicId: string | null;
  level: number;
  x: number;
  y: number;
  /** Radians, 0 = +x, clockwise on screen. */
  angle: number;
  r: number;
  /** Entry point of its line ("Acá arrancás"). */
  entry: boolean;
  /** confidence low: show the "por completar" notch. */
  incomplete: boolean;
  /** Nivel de recomendación de Dager: codifica la forma de la estación. */
  recommendation: Recommendation;
}

export interface MapLine {
  topicId: string;
  letter: string;
  name: string;
  /** CSS value, e.g. "var(--line-economia)". */
  color: string;
}

export interface MapGeometry {
  nodes: MapNode[];
  edges: LayoutEdge[];
  sectors: LayoutSector[];
  rings: LayoutRing[];
  bounds: LayoutBounds;
}

/** Station metadata shared by every density (no coordinates). */
export type MapNodeMeta = Omit<MapNode, "x" | "y" | "angle" | "r">;

/** Edge metadata shared by every density: the same edges, in the same order, with a different path. */
export interface MapEdgeMeta {
  from: string;
  to: string;
  kind: LayoutEdgeKind;
  reason?: string;
}

/** What one density adds to the shared part: positions and paths only. */
export interface MapDensityLayout {
  /** Flat [x, y, angle, r] per node, in `nodes` order. */
  pos: number[];
  /** SVG path `d` per edge, in `edges` order. */
  paths: string[];
  sectors: LayoutSector[];
  rings: LayoutRing[];
  bounds: LayoutBounds;
}

export interface MapGeometrySet {
  nodes: MapNodeMeta[];
  edges: MapEdgeMeta[];
  layouts: Record<Density, MapDensityLayout>;
}

/** Rebuilds the full geometry of one density from the shared set. */
export function resolveGeometry(set: MapGeometrySet, density: Density): MapGeometry {
  const l = set.layouts[density];
  return {
    nodes: set.nodes.map((n, i) => ({
      ...n,
      x: l.pos[i * 4],
      y: l.pos[i * 4 + 1],
      angle: l.pos[i * 4 + 2],
      r: l.pos[i * 4 + 3],
    })),
    edges: set.edges.map((e, i) => ({ ...e, path: l.paths[i] })),
    sectors: l.sectors,
    rings: l.rings,
    bounds: l.bounds,
  };
}

/** Mapa de una sola línea: la línea ocupa todo el círculo. */
export interface MapFocus {
  topicId: string;
  /** Solo las estaciones de la línea (más Km 0), re-posicionadas; todas con la tinta de la línea. */
  geometry: MapGeometry;
  /** Estaciones de la línea, sin Km 0. */
  count: number;
  /** Líneas con las que combina cada estación (las demás líneas no se dibujan). */
  links: ReadonlyMap<string, readonly string[]>;
}

/** Arma la geometría del foco a partir del layout propio de la línea y los metadatos compartidos. */
export function resolveFocus(set: MapGeometrySet, focus: FocusLayout): MapFocus {
  const metaById = new Map(set.nodes.map((n) => [n.id, n]));
  const { layout, topicId } = focus;
  const nodes: MapNode[] = [];
  for (const p of layout.nodes) {
    const meta = metaById.get(p.id);
    if (!meta) continue;
    nodes.push({
      ...meta,
      // Every station of the focus wears the line's ink, even one whose primary line is another.
      topicId: meta.level === 0 ? null : topicId,
      entry: meta.entry && meta.topicId === topicId,
      x: p.x,
      y: p.y,
      angle: p.angle,
      r: p.r,
    });
  }
  return {
    topicId,
    geometry: { nodes, edges: layout.edges, sectors: layout.sectors, rings: layout.rings, bounds: layout.bounds },
    count: focus.count,
    links: focus.links,
  };
}

export const ZONE_NAMES: Record<number, string> = {
  1: "INTRO",
  2: "INTERMEDIO",
  3: "AVANZADO",
  4: "ESPECIALISTA",
};
