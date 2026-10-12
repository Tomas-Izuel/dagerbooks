import { lineInfo } from "@/components/page/lines";
import { getBook, getRoutes } from "@/lib/catalog/queries";
import type { Route } from "@/lib/catalog/schema";
import type { RouteSummary } from "./progress";

export function summarize(route: Route): RouteSummary {
  const line = lineInfo(route.line)!;
  return {
    id: route.id,
    name: route.name,
    kind: route.kind,
    line: { letter: line.letter, color: line.color, name: line.name },
    promise: route.promise,
    steps: route.steps.map((s) => ({ id: s.book, title: getBook(s.book)!.title, ...(s.optional ? { optional: true } : {}), ...(s.gap ? { gap: true } : {}) })),
  };
}

/** Todas las rutas, en el orden del YAML. */
export const routeSummaries = (): RouteSummary[] => getRoutes().map(summarize);
