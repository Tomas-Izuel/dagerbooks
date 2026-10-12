/** Un paso de ruta tal como lo necesita el cliente: serializable y sin el catálogo entero. */
export interface RouteStepRef {
  id: string;
  title: string;
  optional?: boolean;
  /** Hay un tramo a pie antes de este paso. */
  gap?: boolean;
}

/** Ruta resumida para el cliente (índice, "Tus rutas", progreso). */
export interface RouteSummary {
  id: string;
  name: string;
  kind: "corriente" | "objetivo";
  line: { letter: string; color: string; name: string };
  promise: string;
  steps: RouteStepRef[];
}

export interface RouteProgress {
  /** Paradas de la vía principal (sin desvíos). `done`, `total` y `remaining` hablan solo de ella. */
  done: number;
  total: number;
  remaining: number;
  /** Desvíos optativos: se cuentan aparte y nunca bloquean el final. */
  detoursDone: number;
  detoursTotal: number;
  /** Índice de la próxima parada obligatoria no leída (los desvíos no se esperan). -1 si no queda ninguna. */
  next: number;
  /** Leíste algo de la ruta, parada o desvío. */
  started: boolean;
  /** Todas las paradas de la vía principal leídas. */
  complete: boolean;
}

export function routeProgress(steps: readonly RouteStepRef[], read: ReadonlySet<string>): RouteProgress {
  const main = steps.filter((s) => !s.optional);
  const detours = steps.filter((s) => s.optional);
  const done = main.filter((s) => read.has(s.id)).length;
  const detoursDone = detours.filter((s) => read.has(s.id)).length;
  const next = steps.findIndex((s) => !s.optional && !read.has(s.id));
  return {
    done,
    total: main.length,
    remaining: main.length - done,
    detoursDone,
    detoursTotal: detours.length,
    next,
    started: done + detoursDone > 0,
    complete: next === -1,
  };
}

/** "desvíos 0/2" o null si la ruta no tiene desvíos. */
export const detoursLabel = (p: RouteProgress): string | null =>
  p.detoursTotal > 0 ? `${p.detoursTotal === 1 ? "desvío" : "desvíos"} ${p.detoursDone}/${p.detoursTotal}` : null;
