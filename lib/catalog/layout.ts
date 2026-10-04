import type {
  Layout,
  LayoutConfig,
  LayoutEdge,
  LayoutNode,
  LayoutSector,
} from "./layout.types";

export type * from "./layout.types";

/** Structural subset of Book / Topic / Catalog that the layout needs. */
export interface LayoutBook {
  id: string;
  level: number;
  primaryTopic: string | null;
  leadsTo?: readonly string[];
  related?: readonly { id: string; reason?: string }[];
}
export interface LayoutCatalog {
  books: readonly LayoutBook[];
  topics: readonly { id: string }[];
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  firstRingRadius: 190,
  ringSpacing: 175,
  sectorGap: (5 * Math.PI) / 180,
  meridianGap: (16 * Math.PI) / 180,
  minSectorAngle: (14 * Math.PI) / 180,
  startAngle: -Math.PI / 2,
  nodeRadius: 11,
  nodeGap: 16,
  bandFraction: 0.45,
  crowdWeight: 1.5,
  maxLanes: 3,
  relatedBow: 0.55,
  trackArcInset: 52,
  trackCorner: 16,
  trackStraightBelow: 7,
  precision: 2,
};

const TAU = Math.PI * 2;
const MAX_LEVEL = 4;

/** Signed shortest angular difference a - b in (-PI, PI]. */
function angDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}

/** Sector widths: proportional to count, clamped to a minimum (water-filling). */
function sectorWidths(counts: number[], available: number, min: number): number[] {
  const n = counts.length;
  const widths = new Array<number>(n).fill(0);
  const fixed = new Array<boolean>(n).fill(false);
  const effMin = Math.min(min, available / Math.max(n, 1));
  for (let guard = 0; guard <= n; guard++) {
    let fixedSum = 0;
    let free = 0;
    for (let i = 0; i < n; i++) {
      if (fixed[i]) fixedSum += effMin;
      else free += counts[i];
    }
    const perUnit = free > 0 ? (available - fixedSum) / free : 0;
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue;
      if (counts[i] * perUnit < effMin) {
        fixed[i] = true;
        changed = true;
      }
    }
    if (!changed) {
      for (let i = 0; i < n; i++) widths[i] = fixed[i] ? effMin : counts[i] * perUnit;
      return widths;
    }
  }
  return widths.map(() => available / n);
}

export function computeLayout(catalog: LayoutCatalog, partial: Partial<LayoutConfig> = {}): Layout {
  const cfg: LayoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...partial };
  const k = 10 ** cfg.precision;
  const rnd = (v: number) => {
    const r = Math.round(v * k) / k;
    return r === 0 ? 0 : r; // avoid -0
  };
  const minDist = 2 * cfg.nodeRadius + cfg.nodeGap;

  const { books, topics } = catalog;
  const byId = new Map(books.map((b) => [b.id, b]));
  const topicIndex = new Map(topics.map((t, i) => [t.id, i]));
  const root = books.find((b) => b.level === 0);

  // ---- sectors -----------------------------------------------------------
  const counts = topics.map(() => 0);
  const perRing = topics.map(() => new Array<number>(MAX_LEVEL + 1).fill(0));
  for (const b of books) {
    if (b.level === 0) continue;
    const ti = b.primaryTopic === null ? undefined : topicIndex.get(b.primaryTopic);
    if (ti === undefined) {
      throw new Error(`layout: libro "${b.id}" tiene un tema principal desconocido (${String(b.primaryTopic)})`);
    }
    counts[ti]++;
    perRing[ti][Math.min(b.level, MAX_LEVEL)]++;
  }
  const weights = counts.map((c, i) => c + cfg.crowdWeight * Math.max(0, ...perRing[i]));
  const nT = topics.length;
  // The gap between the last and the first sector (the "meridian", centered on
  // startAngle) is wider than the rest: it carries the zone numerals.
  const extraGap = Math.max(0, cfg.meridianGap - cfg.sectorGap);
  const widths = sectorWidths(weights, TAU - nT * cfg.sectorGap - extraGap, cfg.minSectorAngle);
  const sectors: LayoutSector[] = [];
  let cursor = cfg.startAngle + extraGap / 2;
  topics.forEach((t, i) => {
    const start = cursor + cfg.sectorGap / 2;
    const end = start + widths[i];
    sectors.push({
      topicId: t.id,
      startAngle: rnd(start),
      endAngle: rnd(end),
      labelAngle: rnd((start + end) / 2),
      count: counts[i],
    });
    cursor = end + cfg.sectorGap / 2;
  });
  const sectorRaw = topics.map((_, i) => {
    const start = sectors[i].startAngle;
    return { start, end: sectors[i].endAngle, mid: (start + sectors[i].endAngle) / 2 };
  });

  // ---- rings -------------------------------------------------------------
  const ringRadius = (level: number) => (level <= 0 ? 0 : cfg.firstRingRadius + (level - 1) * cfg.ringSpacing);
  const rings = Array.from({ length: MAX_LEVEL }, (_, i) => ({ level: i + 1, radius: ringRadius(i + 1) }));
  const band = cfg.bandFraction * cfg.ringSpacing;

  // ---- parents -----------------------------------------------------------
  const parents = new Map<string, string[]>();
  for (const b of books) {
    for (const to of b.leadsTo ?? []) {
      if (!byId.has(to)) continue;
      (parents.get(to) ?? parents.set(to, []).get(to)!).push(b.id);
    }
  }

  // ---- node placement ----------------------------------------------------
  const pos = new Map<string, LayoutNode>();
  if (root) {
    pos.set(root.id, { id: root.id, x: 0, y: 0, angle: 0, r: 0, ring: 0, sector: null, lane: 0 });
  }
  const crowded: Layout["crowded"] = [];

  for (let level = 1; level <= MAX_LEVEL; level++) {
    for (let ti = 0; ti < nT; ti++) {
      const group = books.filter((b) => b.level === level && b.primaryTopic === topics[ti].id);
      const n = group.length;
      if (n === 0) continue;
      const { start, end, mid } = sectorRaw[ti];

      // Barycenter of parent angles (relative to the sector middle, seam-safe).
      const keyed = group.map((b, order) => {
        const ds: number[] = [];
        for (const p of parents.get(b.id) ?? []) {
          const pn = pos.get(p);
          if (pn && pn.ring > 0) ds.push(angDiff(pn.angle, mid));
        }
        const bary = ds.length ? ds.reduce((a, c) => a + c, 0) / ds.length : 0;
        return { b, order, bary, has: ds.length > 0 };
      });
      keyed.sort((a, c) => a.bary - c.bary || a.order - c.order);

      const R = ringRadius(level);
      const step = (end - start) / n;
      // Choose the smallest lane count that honors the min distance.
      let lanes = 1;
      const laneStepFor = (L: number) => (L > 1 ? band / (L - 1) : 0);
      const okFor = (L: number) => {
        const rMin = R - band / 2;
        const arc = step * (L > 1 ? rMin : R);
        const sameLane = L * arc;
        const adj = L > 1 ? Math.hypot(arc, laneStepFor(L)) : arc;
        return Math.min(sameLane, adj) >= minDist || n === 1;
      };
      while (lanes < cfg.maxLanes && !okFor(lanes)) lanes++;
      if (!okFor(lanes)) crowded.push({ sector: topics[ti].id, ring: level });

      keyed.forEach(({ b }, i) => {
        const angle = start + (i + 0.5) * step;
        // Zig-zag lanes: 0,1,..,L-1 mapped so consecutive nodes alternate radius.
        const lane = i % lanes;
        const r = lanes > 1 ? R - band / 2 + lane * laneStepFor(lanes) : R;
        pos.set(b.id, {
          id: b.id,
          x: rnd(r * Math.cos(angle)),
          y: rnd(r * Math.sin(angle)),
          angle: rnd(angle),
          r: rnd(r),
          ring: level,
          sector: topics[ti].id,
          lane,
        });
      });
    }
  }
  // Keep output in catalog order (stable and caller-friendly).
  const nodes = books.map((b) => pos.get(b.id)).filter((n): n is LayoutNode => !!n);

  // ---- edges -------------------------------------------------------------
  const P = (v: number) => rnd(v);
  const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
  const edges: LayoutEdge[] = [];

  /**
   * Subway-track routing in polar space (the Moscow-ring way): radial out of the
   * source, a concentric arc just inside the target's ring, radial into the
   * target. Corners are rounded with quadratic joins. Deterministic.
   */
  const leadsToPath = (a: LayoutNode, b: LayoutNode): string => {
    if (a.r === 0) return `M0 0L${P(b.x)} ${P(b.y)}`;
    const d = angDiff(b.angle, a.angle);
    if (Math.abs(d) * Math.max(a.r, b.r) < cfg.trackStraightBelow) {
      return `M${P(a.x)} ${P(a.y)}L${P(b.x)} ${P(b.y)}`;
    }
    let rm = b.r - cfg.trackArcInset;
    if (rm < a.r + 24) rm = (a.r + b.r) / 2;
    const arcLen = Math.abs(d) * rm;
    const c = Math.min(cfg.trackCorner, (rm - a.r) * 0.45, (b.r - rm) * 0.45, arcLen * 0.45);
    const s = d > 0 ? 1 : -1;
    const da = c / rm;
    const aAngle = a.angle;
    const bAngle = a.angle + d;
    const [p1x, p1y] = polar(rm - c, aAngle);
    const [k1x, k1y] = polar(rm, aAngle);
    const [p2x, p2y] = polar(rm, aAngle + s * da);
    const [p3x, p3y] = polar(rm, bAngle - s * da);
    const [k2x, k2y] = polar(rm, bAngle);
    const [p4x, p4y] = polar(rm + c, bAngle);
    const sweep = s > 0 ? 1 : 0;
    return (
      `M${P(a.x)} ${P(a.y)}L${P(p1x)} ${P(p1y)}Q${P(k1x)} ${P(k1y)} ${P(p2x)} ${P(p2y)}` +
      `A${P(rm)} ${P(rm)} 0 0 ${sweep} ${P(p3x)} ${P(p3y)}Q${P(k2x)} ${P(k2y)} ${P(p4x)} ${P(p4y)}L${P(b.x)} ${P(b.y)}`
    );
  };
  const relatedPath = (a: LayoutNode, b: LayoutNode): string => {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const s = 1 - cfg.relatedBow;
    return `M${P(a.x)} ${P(a.y)}Q${P(mx * s)} ${P(my * s)} ${P(b.x)} ${P(b.y)}`;
  };

  const explicitFromRoot = new Set<string>();
  for (const b of books) {
    const from = pos.get(b.id);
    if (!from) continue;
    for (const to of b.leadsTo ?? []) {
      const target = pos.get(to);
      if (!target) continue;
      if (b.level === 0) explicitFromRoot.add(to);
      edges.push({ from: b.id, to, kind: "leadsTo", path: leadsToPath(from, target) });
    }
  }
  if (root) {
    for (const b of books) {
      if (b.level !== 1 || explicitFromRoot.has(b.id)) continue;
      const n = pos.get(b.id);
      if (n) edges.push({ from: root.id, to: b.id, kind: "implicitRoot", path: `M0 0L${P(n.x)} ${P(n.y)}` });
    }
  }
  const seen = new Set<string>();
  for (const b of books) {
    const a = pos.get(b.id);
    if (!a) continue;
    for (const rel of b.related ?? []) {
      const c = pos.get(rel.id);
      if (!c || rel.id === b.id) continue;
      const key = b.id < rel.id ? `${b.id}|${rel.id}` : `${rel.id}|${b.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: b.id, to: rel.id, kind: "related", path: relatedPath(a, c), reason: rel.reason });
    }
  }

  // ---- stats & bounds ----------------------------------------------------
  let minNodeDistance = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d < minNodeDistance) minNodeDistance = d;
    }
  }
  const outerRadius = rings[MAX_LEVEL - 1].radius;
  const ext = outerRadius + band / 2 + cfg.nodeRadius;
  const bounds = { minX: -ext, minY: -ext, maxX: ext, maxY: ext, width: 2 * ext, height: 2 * ext };

  return { nodes, sectors, rings, edges, bounds, outerRadius, minNodeDistance, crowded, config: cfg };
}
