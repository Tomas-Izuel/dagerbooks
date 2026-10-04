/**
 * Foco por línea en la vista Subte: una sola banda. Puro y sin dependencias de Node ni de Zod.
 * Reusa el subconjunto de `focus.ts` (libros con la línea en `topics` en cualquier posición, más Km 0)
 * y le da a todos esa línea como único sector. Km 0 deja de ser una píldora larga: con una sola banda
 * `pill` abarca solo sus filas y el render la dibuja como estación.
 */
import { buildFocusSubset, type FocusBook, type FocusRelated } from "./focus";
import { computeSubwayLayout, DEFAULT_SUBWAY_CONFIG } from "./subway";
import type { SubwayBook, SubwayFocusLayout, SubwayLayoutConfig, SubwayRecommendation } from "./subway.types";

/** `FocusBook` más lo que solo sirve para ordenar el riel. */
export interface SubwayFocusBook extends FocusBook {
  title?: string;
  recommendation?: SubwayRecommendation;
}

/** En foco hay más aire entre carriles. */
export const FOCUS_LANE_SCALE = 1.25;

export function computeSubwayFocusLayout(
  books: readonly SubwayFocusBook[],
  related: readonly FocusRelated[],
  topicId: string,
  config: Partial<SubwayLayoutConfig> = {},
): SubwayFocusLayout {
  const { subset, inSet, relatedBy, count, links } = buildFocusSubset(books, related, topicId);
  const root = subset.find((b) => b.level === 0);
  const fromRoot = new Set(root?.leadsTo ?? []);
  const subwayBooks: SubwayBook[] = (subset as SubwayFocusBook[]).map((b) => ({
    id: b.id,
    level: b.level,
    primaryTopic: b.level === 0 ? null : topicId,
    leadsTo: b.leadsTo?.filter((to) => inSet.has(to)),
    related: relatedBy.get(b.id),
    title: b.title,
    recommendation: b.recommendation,
    // "Acá arrancás" solo si es la entrada de esta línea (no de la línea primaria de otro libro).
    entry: fromRoot.has(b.id) && b.topics[0] === topicId,
  }));
  const lanePitch = (config.lanePitch ?? DEFAULT_SUBWAY_CONFIG.lanePitch) * FOCUS_LANE_SCALE;
  const layout = computeSubwayLayout(
    { books: subwayBooks, topics: [{ id: topicId }] },
    { ...config, lanePitch: Math.round(lanePitch * 100) / 100 },
  );
  return { topicId, layout, count, links };
}
