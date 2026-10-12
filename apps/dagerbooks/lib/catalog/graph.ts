/** Utilidades puras de grafo, sin I/O (seguras para cliente y servidor). */

export interface GraphNode {
  id: string;
  leadsTo?: readonly string[];
}

export interface Adjacency {
  out: Map<string, string[]>;
  in: Map<string, string[]>;
}

export function buildAdjacency(nodes: readonly GraphNode[]): Adjacency {
  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    inn.set(n.id, []);
  }
  for (const n of nodes) {
    for (const t of n.leadsTo ?? []) {
      out.get(n.id)?.push(t);
      inn.get(t)?.push(n.id);
    }
  }
  return { out, in: inn };
}

/**
 * Regla del catálogo: todo libro de nivel 1 cuelga implícitamente del libro raíz (nivel 0),
 * aunque no esté en su `leadsTo`. Devuelve nodos con esas aristas añadidas (sin duplicar).
 */
export function withImplicitRootEdges<T extends GraphNode & { level: number }>(nodes: readonly T[]): GraphNode[] {
  const root = nodes.find((n) => n.level === 0);
  if (!root) return [...nodes];
  const level1 = nodes.filter((n) => n.level === 1).map((n) => n.id);
  return nodes.map((n) =>
    n === root ? { id: n.id, leadsTo: [...new Set([...(n.leadsTo ?? []), ...level1])] } : { id: n.id, leadsTo: n.leadsTo },
  );
}

/** Todos los nodos alcanzables desde `start` (sin incluirlo). */
export function reach(start: string, edges: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(edges.get(start) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === start || seen.has(id)) continue;
    seen.add(id);
    stack.push(...(edges.get(id) ?? []));
  }
  return seen;
}

/** Devuelve un ciclo como lista de ids (primero repetido al final) o null. */
export function findCycle(nodes: readonly GraphNode[]): string[] | null {
  const { out } = buildAdjacency(nodes);
  const state = new Map<string, 1 | 2>();
  const path: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    path.push(id);
    for (const next of out.get(id) ?? []) {
      if (!out.has(next)) continue;
      if (state.get(next) === 1) return [...path.slice(path.indexOf(next)), next];
      if (!state.has(next)) {
        const c = visit(next);
        if (c) return c;
      }
    }
    path.pop();
    state.set(id, 2);
    return null;
  };
  for (const n of nodes) {
    if (!state.has(n.id)) {
      const c = visit(n.id);
      if (c) return c;
    }
  }
  return null;
}
