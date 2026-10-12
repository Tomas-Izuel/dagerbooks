/** Pure viewport math (graph coords <-> screen), no d3 dependency. */

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Scale at which `bounds` fully fits in `size` (with `padding` px each side). */
export function fitScale(bounds: Bounds, size: Size, padding = 0): number {
  const bw = Math.max(bounds.x1 - bounds.x0, 1e-6);
  const bh = Math.max(bounds.y1 - bounds.y0, 1e-6);
  const k = Math.min(
    Math.max(size.width - 2 * padding, 1) / bw,
    Math.max(size.height - 2 * padding, 1) / bh,
  );
  return k;
}

/** Project a graph point to screen pixels given a transform {x, y, k}. */
export function toScreen(t: { x: number; y: number; k: number }, p: Point): Point {
  return { x: p.x * t.k + t.x, y: p.y * t.k + t.y };
}

/** True when the screen point lies outside the viewport shrunk by `margin`/insets. */
export function isOffscreen(
  screen: Point,
  size: Size,
  margin = 24,
  insets: Partial<Insets> = {},
): boolean {
  const left = (insets.left ?? 0) + margin;
  const top = (insets.top ?? 0) + margin;
  const right = size.width - (insets.right ?? 0) - margin;
  const bottom = size.height - (insets.bottom ?? 0) - margin;
  return screen.x < left || screen.x > right || screen.y < top || screen.y > bottom;
}

/**
 * Hit-target helper: radius (graph units) of a transparent hit circle so the
 * on-screen target is at least `targetPx` wide at zoom `k`.
 * 24px = WCAG 2.5.8 minimum, 44px = comfortable touch.
 */
export function hitRadius(nodeRadius: number, k: number, targetPx = 44): number {
  return Math.max(nodeRadius, targetPx / 2 / k);
}

/** Smallest zoom at which a node of `nodeRadius` still gets `targetPx` hit size without a hit circle. */
export function minZoomForTarget(nodeRadius: number, targetPx = 24): number {
  return targetPx / (2 * nodeRadius);
}
