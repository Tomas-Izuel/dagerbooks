import type { Recommendation } from "@/lib/catalog/schema";

/**
 * Cliente-seguro: sólo importa el TIPO del esquema (no arrastra zod al bundle).
 * Los textos viven en RECOMMENDATION_LABELS (schema.ts) y llegan por props desde el servidor.
 */
export const REC_ORDER = ["fuerte", "interesante", "mencion"] as const satisfies readonly Recommendation[];

/** Compile-time: si el contrato suma un nivel, esto deja de compilar hasta que se codifique acá. */
type _Exhaustive = Recommendation extends (typeof REC_ORDER)[number] ? true : never;
export const _exhaustive: _Exhaustive = true;

/**
 * Codificación de la estación en el mapa, en unidades del mapa (la estación "interesante" es la de siempre:
 * r 7, trazo 3). El glifo de leyenda / cartelera / panel dibuja exactamente estos valores.
 */
export const REC_DOT: Record<Recommendation, { r: number; stroke: number; muted: boolean }> = {
  fuerte: { r: 8.5, stroke: 4.5, muted: false },
  interesante: { r: 7, stroke: 3, muted: false },
  mencion: { r: 5, stroke: 2, muted: true },
};

export const ALL_RECS: readonly Recommendation[] = REC_ORDER;

export function isRecommendation(v: string): v is Recommendation {
  return (REC_ORDER as readonly string[]).includes(v);
}

/** `?rec=fuerte,interesante`. Tolerante: ignora inválidos y repetidos; vacío o sin válidos = los tres. */
export function parseRec(raw: string | null | undefined): Recommendation[] {
  if (!raw) return [...ALL_RECS];
  const wanted = new Set(raw.split(",").map((s) => s.trim()).filter(isRecommendation));
  if (wanted.size === 0) return [...ALL_RECS];
  return REC_ORDER.filter((r) => wanted.has(r));
}

export const isAllRecs = (rec: readonly Recommendation[]) => rec.length === ALL_RECS.length;

/** Orden canónico; null cuando son los tres (el parámetro se omite de la URL). */
export function serializeRec(rec: readonly Recommendation[]): string | null {
  const ordered = REC_ORDER.filter((r) => rec.includes(r));
  return ordered.length === 0 || ordered.length === ALL_RECS.length ? null : ordered.join(",");
}

/**
 * Siguiente selección al tocar un nivel. Con los tres activos, tocar uno lo AÍSLA (lo que se espera de un
 * filtro); con selección parcial alterna; si se desmarca el último vuelve a los tres (nunca queda en cero).
 */
export function toggleRec(current: readonly Recommendation[], r: Recommendation): Recommendation[] {
  if (isAllRecs(current)) return [r];
  const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
  return next.length === 0 ? [...ALL_RECS] : REC_ORDER.filter((x) => next.includes(x));
}
