/**
 * Pure keyboard-navigation helpers for a radial graph.
 *
 * Angle convention (must match the layout): a node sits at
 *   x = cx + r * cos(angle), y = cy + r * sin(angle)   (SVG coords, y down)
 * so increasing angle runs CLOCKWISE on screen. Angles may be any real number;
 * they are normalised to [0, 2π) internally.
 */

export interface NavNode {
  id: string;
  /** Radians, see convention above. Ignored for ring 0. */
  angle: number;
  /** 0 = center root, 1..n = outward. */
  ring: number;
}

export type NavKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

const TAU = Math.PI * 2;

export function normalizeAngle(a: number): number {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
}

/** Shortest absolute angular distance in [0, π]. */
export function angularDistance(a: number, b: number): number {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return d > Math.PI ? TAU - d : d;
}

/** Deterministic comparator: by angle, then id (stable ordering for ties). */
function byAngleThenId(a: NavNode, b: NavNode): number {
  const d = normalizeAngle(a.angle) - normalizeAngle(b.angle);
  return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Nodes of a ring ordered clockwise starting at angle 0. */
export function ringOrder(nodes: readonly NavNode[], ring: number): NavNode[] {
  return nodes.filter((n) => n.ring === ring).sort(byAngleThenId);
}

/**
 * Angular neighbour on the same ring, wrapping around. `step` +1 = clockwise
 * (increasing angle), -1 = counter-clockwise. Returns null when the node is
 * alone on its ring or unknown.
 */
export function ringNeighbour(
  nodes: readonly NavNode[],
  id: string,
  step: 1 | -1,
): NavNode | null {
  const current = nodes.find((n) => n.id === id);
  if (!current) return null;
  const order = ringOrder(nodes, current.ring);
  if (order.length < 2) return null;
  const i = order.findIndex((n) => n.id === id);
  return order[(i + step + order.length) % order.length];
}

/**
 * Node on `ring` closest in angle to `angle` (ties: lower angle, then id).
 * `excludeId` is skipped. Returns null when the ring is empty.
 */
export function nearestByAngle(
  nodes: readonly NavNode[],
  ring: number,
  angle: number,
  excludeId?: string,
): NavNode | null {
  let best: NavNode | null = null;
  let bestD = Infinity;
  for (const n of ringOrder(nodes, ring)) {
    if (n.id === excludeId) continue;
    const d = angularDistance(n.angle, angle);
    if (d < bestD - 1e-12) {
      best = n;
      bestD = d;
    }
  }
  return best;
}

/** Sorted list of distinct rings present in `nodes`. */
export function ringsOf(nodes: readonly NavNode[]): number[] {
  return [...new Set(nodes.map((n) => n.ring))].sort((a, b) => a - b);
}

/**
 * Nearest node one ring outward (+1) or inward (-1), skipping empty rings.
 * `referenceAngle` defaults to the current node's angle; pass a remembered
 * angle so out-then-back-in returns to where you started instead of drifting.
 * Moving inward to ring 0 returns the root regardless of angle.
 */
export function ringStep(
  nodes: readonly NavNode[],
  id: string,
  direction: 1 | -1,
  referenceAngle?: number,
): NavNode | null {
  const current = nodes.find((n) => n.id === id);
  if (!current) return null;
  const rings = ringsOf(nodes);
  const idx = rings.indexOf(current.ring) + direction;
  if (idx < 0 || idx >= rings.length) return null;
  const targetRing = rings[idx];
  return nearestByAngle(nodes, targetRing, referenceAngle ?? current.angle);
}

/**
 * Screen-aware left/right: ArrowRight should move the focus toward the right
 * of the screen. The clockwise tangent at angle a has x-component -sin(a), so
 * on the upper half clockwise is rightward and on the lower half it is leftward.
 * Returns the ring step (+1 clockwise / -1 counter-clockwise).
 */
export function horizontalStep(
  angle: number,
  key: "ArrowLeft" | "ArrowRight",
): 1 | -1 {
  const clockwiseIsRight = Math.sin(angle) <= 1e-9; // upper half incl. horizon
  const right = key === "ArrowRight";
  return right === clockwiseIsRight ? 1 : -1;
}

/**
 * Resolve an arrow key to the next node id (or null = stay).
 * Up = outward, Down = inward, Left/Right = ring neighbour (screen-aware).
 */
export function resolveArrow(
  nodes: readonly NavNode[],
  id: string,
  key: NavKey,
  referenceAngle?: number,
): NavNode | null {
  const current = nodes.find((n) => n.id === id);
  if (!current) return null;
  switch (key) {
    case "ArrowUp":
      return ringStep(nodes, id, 1, referenceAngle);
    case "ArrowDown":
      return ringStep(nodes, id, -1, referenceAngle);
    case "ArrowLeft":
    case "ArrowRight":
      if (current.ring === 0) return null;
      return ringNeighbour(nodes, id, horizontalStep(current.angle, key));
  }
}

/** Default tab stop: the root (lowest ring, lowest angle) or null if empty. */
export function defaultTabStop(nodes: readonly NavNode[]): NavNode | null {
  if (nodes.length === 0) return null;
  return [...nodes].sort((a, b) => a.ring - b.ring || byAngleThenId(a, b))[0];
}
