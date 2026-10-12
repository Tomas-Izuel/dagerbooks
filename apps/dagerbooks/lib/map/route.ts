import type { LayoutEdge } from "@/lib/catalog/layout.types";

export const edgeKey = (e: { from: string; to: string }) => `${e.from}>${e.to}`;

/** The slice of a Selection the route needs (structural: `Selection` from lib/state/explorer fits). */
export interface RouteSelection {
  id: string;
  prerequisites: ReadonlySet<string>;
  unlocks: ReadonlySet<string>;
}

export interface MapRoute {
  /** Prerequisite legs, each with the number of legs before it counting from the root (animation order). */
  run: { edge: LayoutEdge; index: number }[];
  runKeys: Set<string>;
  /** Edges of the unlocked stations, outward from the selection. */
  unlock: Set<string>;
  /** Number of sequential steps of the train run. */
  n: number;
}

/**
 * The prerequisite chain back to the root (drawn as a train run) and the edges the selection
 * unlocks. Depends only on the edges, the selection and the root id, never on the geometry,
 * so every view computes it the same way.
 */
export function deriveRoute(
  edges: readonly LayoutEdge[],
  selection: RouteSelection,
  rootId: string | undefined,
): MapRoute {
  const P = selection.prerequisites;
  const U = selection.unlocks;
  const run: LayoutEdge[] = [];
  const unlock = new Set<string>();
  for (const e of edges) {
    if (e.kind === "related") continue;
    if ((e.to === selection.id || P.has(e.to)) && P.has(e.from)) run.push(e);
    else if ((e.from === selection.id || U.has(e.from)) && U.has(e.to)) unlock.add(edgeKey(e));
  }
  const depth = new Map<string, number>(rootId ? [[rootId, 0]] : []);
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const e of run) {
      const d = depth.get(e.from);
      if (d === undefined) continue;
      if ((depth.get(e.to) ?? Infinity) > d + 1) {
        depth.set(e.to, d + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const steps = run.map((e) => depth.get(e.from) ?? 0);
  const n = Math.max(1, ...steps.map((s) => s + 1));
  return { run: run.map((e, i) => ({ edge: e, index: steps[i] })), runKeys: new Set(run.map(edgeKey)), unlock, n };
}
