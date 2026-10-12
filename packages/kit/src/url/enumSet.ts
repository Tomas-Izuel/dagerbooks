/**
 * Conjunto de valores de un enum en un parámetro de URL (`?rec=fuerte,interesante`).
 * Orden canónico fijo; el conjunto completo se omite de la URL.
 */
export function createEnumSetCodec<const T extends string>(order: readonly T[]) {
  const all: readonly T[] = order;
  const is = (v: string): v is T => (order as readonly string[]).includes(v);
  return {
    all,
    is,
    /** Tolerante: ignora inválidos y repetidos; vacío o sin válidos = todos. */
    parse(raw: string | null | undefined): T[] {
      if (!raw) return [...all];
      const wanted = new Set(raw.split(",").map((s) => s.trim()).filter(is));
      if (wanted.size === 0) return [...all];
      return order.filter((r) => wanted.has(r));
    },
    isAll: (set: readonly T[]) => set.length === all.length,
    /** Orden canónico; null cuando son todos (el parámetro se omite de la URL). */
    serialize(set: readonly T[]): string | null {
      const ordered = order.filter((r) => set.includes(r));
      return ordered.length === 0 || ordered.length === all.length ? null : ordered.join(",");
    },
    /** Alterna un valor como una casilla. El último activo no se puede apagar (nunca queda en cero). */
    toggle(current: readonly T[], v: T): T[] {
      if (current.includes(v)) {
        return current.length === 1 ? [...current] : order.filter((x) => x !== v && current.includes(x));
      }
      return order.filter((x) => x === v || current.includes(x));
    },
  };
}
