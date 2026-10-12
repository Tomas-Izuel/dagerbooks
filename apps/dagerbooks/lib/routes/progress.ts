import type { RouteProgress, RouteStepRef } from "@estantes/kit";

export { routeProgress, type RouteProgress, type RouteStepRef } from "@estantes/kit";

/** Ruta resumida para el cliente (índice, "Tus rutas", progreso). */
export interface RouteSummary {
  id: string;
  name: string;
  kind: "corriente" | "objetivo";
  line: { letter: string; color: string; name: string };
  promise: string;
  steps: RouteStepRef[];
}

/** "desvíos 0/2" o null si la ruta no tiene desvíos. */
export const detoursLabel = (p: RouteProgress): string | null =>
  p.detoursTotal > 0 ? `${p.detoursTotal === 1 ? "desvío" : "desvíos"} ${p.detoursDone}/${p.detoursTotal}` : null;
