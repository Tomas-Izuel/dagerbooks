export interface LayoutConfig {
  /** Radius of ring 1 (px, SVG user units). */
  firstRingRadius: number;
  /** Radial distance between rings. */
  ringSpacing: number;
  /** Gap between sectors (radians). */
  sectorGap: number;
  /** Width of the gap centered on `startAngle` (between last and first sector); >= sectorGap. Hosts the zone numerals. */
  meridianGap: number;
  /** Minimum angular width of a sector (radians). */
  minSectorAngle: number;
  /** Where the first topic starts (radians; -PI/2 = top). Sectors run clockwise. */
  startAngle: number;
  /** Visual node radius used for spacing. */
  nodeRadius: number;
  /** Extra clear space between node circles. */
  nodeGap: number;
  /** Total radial width of a ring band used by staggered lanes, as a fraction of ringSpacing. */
  bandFraction: number;
  /** Extra sector weight per book in the sector's most populated ring (0 = pure book count). */
  crowdWeight: number;
  /** Max sub-radii (lanes) per ring+sector. */
  maxLanes: number;
  /** 0..1: how far related arcs bow toward the center (control point scale = 1 - bow). */
  relatedBow: number;
  /** How far inside the target's radius the concentric track arc runs. */
  trackArcInset: number;
  /** Corner rounding radius of track joins. */
  trackCorner: number;
  /** Angular offsets shorter than this (px at the node radius) route as one straight segment. */
  trackStraightBelow: number;
  /** Decimals kept in coordinates / paths. */
  precision: number;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  /** Radians, 0 = +x, clockwise on screen. Root: 0. */
  angle: number;
  /** Polar radius actually used (ring radius +/- lane offset). */
  r: number;
  /** Level 0-4. */
  ring: number;
  /** Primary topic id, null for the root. */
  sector: string | null;
  /** Sub-radius index within the ring band (0 when not staggered). */
  lane: number;
}

export interface LayoutSector {
  topicId: string;
  startAngle: number;
  endAngle: number;
  labelAngle: number;
  count: number;
}

export interface LayoutRing {
  level: number;
  radius: number;
}

export type LayoutEdgeKind = "leadsTo" | "related" | "implicitRoot";

export interface LayoutEdge {
  from: string;
  to: string;
  kind: LayoutEdgeKind;
  /** SVG path `d` string. */
  path: string;
  /** Why the two books connect (`related` edges only). */
  reason?: string;
  /** Anchor for the "COMBINACIÓN" tag (midpoint of the route). Filled by the subway layout only. */
  mid?: { x: number; y: number };
  /** Route vertices (only 0 / 45 / 90 degree segments). Filled by the subway layout only. */
  pts?: readonly [number, number][];
}

export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Layout {
  nodes: LayoutNode[];
  sectors: LayoutSector[];
  rings: LayoutRing[];
  edges: LayoutEdge[];
  bounds: LayoutBounds;
  /** Radius of the outermost ring. */
  outerRadius: number;
  /** Smallest center-to-center distance between any two nodes (Infinity if < 2 nodes). */
  minNodeDistance: number;
  /** Ring/sector groups where maxLanes was not enough to honor the min distance. */
  crowded: { sector: string; ring: number }[];
  config: LayoutConfig;
}
