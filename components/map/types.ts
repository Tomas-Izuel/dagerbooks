import type { LayoutBounds, LayoutEdge, LayoutRing, LayoutSector } from "@/lib/catalog/layout.types";

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

export const ZONE_NAMES: Record<number, string> = {
  1: "INTRO",
  2: "INTERMEDIO",
  3: "AVANZADO",
  4: "ESPECIALISTA",
};
