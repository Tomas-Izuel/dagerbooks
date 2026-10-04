/**
 * Modo foco: el mapa de una sola línea. Puro y sin dependencias de Node ni de Zod
 * (solo `layout.ts`), así que corre igual en el servidor y en el cliente.
 *
 * Se arma el subconjunto de libros que tienen la línea en `topics` (en cualquier posición)
 * más Km 0, se les asigna a todos esa línea como único sector y se reusa `computeLayout`:
 * con un solo sector el reparto angular ocupa el círculo entero (menos el meridiano).
 */
import { computeLayout, type Layout, type LayoutBook, type LayoutConfig } from "./layout";

/** Subconjunto estructural de Book que necesita el foco. */
export interface FocusBook {
  id: string;
  /** 0 = Km 0. */
  level: number;
  /** El primero es la línea primaria. Vacío solo en Km 0. */
  topics: readonly string[];
  leadsTo?: readonly string[];
}

export interface FocusRelated {
  from: string;
  to: string;
  reason?: string;
}

export interface FocusLayout {
  topicId: string;
  layout: Layout;
  /** Estaciones del foco (sin Km 0). */
  count: number;
  /**
   * Combinaciones con otras líneas, por estación: ids de las líneas con las que conecta
   * (otras `topics` propias, `related` y `leadsTo` hacia libros que no están en el foco).
   * Reemplazan a las vías, que se dibujarían hacia libros que acá no existen.
   */
  links: ReadonlyMap<string, readonly string[]>;
}

export function computeFocusLayout(
  books: readonly FocusBook[],
  related: readonly FocusRelated[],
  topicId: string,
  config: Partial<LayoutConfig> = {},
): FocusLayout {
  const byId = new Map(books.map((b) => [b.id, b]));
  const member = (b: FocusBook) => b.level === 0 || b.topics.includes(topicId);
  const subset = books.filter(member);
  const inSet = new Set(subset.map((b) => b.id));

  const relatedBy = new Map<string, { id: string; reason?: string }[]>();
  for (const r of related) {
    if (!inSet.has(r.from) || !inSet.has(r.to)) continue;
    (relatedBy.get(r.from) ?? relatedBy.set(r.from, []).get(r.from)!).push({ id: r.to, reason: r.reason });
  }
  const layoutBooks: LayoutBook[] = subset.map((b) => ({
    id: b.id,
    level: b.level,
    primaryTopic: b.level === 0 ? null : topicId,
    leadsTo: b.leadsTo?.filter((to) => inSet.has(to)),
    related: relatedBy.get(b.id),
  }));
  const layout = computeLayout({ books: layoutBooks, topics: [{ id: topicId }] }, config);

  // Cross-line links: every connection whose other end is not part of the line.
  const links = new Map<string, Set<string>>();
  const add = (id: string, other: FocusBook | undefined) => {
    const t = other?.topics[0];
    if (!t || t === topicId) return;
    (links.get(id) ?? links.set(id, new Set()).get(id)!).add(t);
  };
  for (const b of subset) {
    if (b.level === 0) continue;
    for (const t of b.topics) if (t !== topicId) (links.get(b.id) ?? links.set(b.id, new Set()).get(b.id)!).add(t);
    for (const to of b.leadsTo ?? []) if (!inSet.has(to)) add(b.id, byId.get(to));
  }
  for (const b of books) {
    if (inSet.has(b.id)) continue;
    for (const to of b.leadsTo ?? []) if (inSet.has(to)) add(to, b);
  }
  for (const r of related) {
    if (inSet.has(r.from) && !inSet.has(r.to)) add(r.from, byId.get(r.to));
    else if (inSet.has(r.to) && !inSet.has(r.from)) add(r.to, byId.get(r.from));
  }

  return {
    topicId,
    layout,
    count: subset.filter((b) => b.level > 0).length,
    links: new Map([...links].map(([id, set]) => [id, [...set]])),
  };
}
