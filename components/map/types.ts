import type { LayoutBounds, LayoutEdge, LayoutEdgeKind, LayoutRing, LayoutSector } from "@/lib/catalog/layout.types";
import type { Recommendation } from "@/lib/catalog/schema";
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

export const ZONE_NAMES: Record<number, string> = {
  1: "INTRO",
  2: "INTERMEDIO",
  3: "AVANZADO",
  4: "ESPECIALISTA",
};
