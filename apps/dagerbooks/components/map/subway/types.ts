import type { LayoutBounds, LayoutEdge } from "@/lib/catalog/layout.types";
import type { SubwayBand, SubwayLabelSlot, SubwayRole, SubwayZone } from "@/lib/catalog/subway.types";
import type { MapNode } from "../types";

/**
 * Estación del subte: un `MapNode` con `angle = 0` y `r = x`, así `Station` se reutiliza sin cambios
 * (la marca de entrada, un tick vertical, queda perpendicular a una vía horizontal).
 */
export type SubwayMapNode = MapNode & {
  band: number;
  lane: number;
  sub: number;
  role: SubwayRole;
  labelSlot: SubwayLabelSlot;
  rank: number;
};

export interface SubwayGeometry {
  nodes: SubwayMapNode[];
  /** Con `pts` y `mid` siempre presentes. */
  edges: LayoutEdge[];
  bands: SubwayBand[];
  zones: SubwayZone[];
  pill: { x: number; y0: number; y1: number; width: number };
  bounds: LayoutBounds;
}

/** Foco por línea en el subte: una sola banda. */
export interface SubwayFocus {
  topicId: string;
  geometry: SubwayGeometry;
  /** Estaciones de la línea, sin Km 0. */
  count: number;
  /** Líneas con las que combina cada estación. */
  links: ReadonlyMap<string, readonly string[]>;
}
