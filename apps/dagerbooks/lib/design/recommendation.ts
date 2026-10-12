import { createEnumSetCodec } from "@estantes/kit";
import type { Recommendation } from "@/lib/catalog/schema";

/**
 * Cliente-seguro: sólo importa el TIPO del esquema (no arrastra zod al bundle).
 * Los textos viven en RECOMMENDATION_LABELS (creator.config.ts) y llegan por props desde el servidor.
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

const rec = createEnumSetCodec(REC_ORDER);

export const ALL_RECS: readonly Recommendation[] = rec.all;

export const isRecommendation = rec.is;

/** `?rec=fuerte,interesante`. Tolerante: ignora inválidos y repetidos; vacío o sin válidos = los tres. */
export const parseRec = rec.parse;

export const isAllRecs = rec.isAll;

/** Orden canónico; null cuando son los tres (el parámetro se omite de la URL). */
export const serializeRec = rec.serialize;

/**
 * Siguiente selección al tocar un nivel: alterna, como una casilla. El último activo no se puede apagar
 * (nunca queda en cero); para volver a los tres está "Ver todos".
 */
export const toggleRec = rec.toggle;
