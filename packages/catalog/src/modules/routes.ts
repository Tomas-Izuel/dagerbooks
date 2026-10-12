/** Módulo `routes`: itinerarios de lectura curados que cruzan temas, con la cita que respalda cada paso. */
import * as z from "zod";
import { GapSchema, Slug } from "../primitives";
import type { Reporter } from "../report";

export const ROUTE_KINDS = ["corriente", "objetivo"] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];

export const ROUTE_LIMITS = { name: 40, promise: 140, summary: 320, why: 160, steps: [4, 10] } as const;

/** Evidencia de que el creador dictó el orden de este paso (video o stream). */
export const RouteOrderSchema = z.strictObject({
  url: z.url({ error: "url inválida" }),
  timestamp: z.string().min(1).optional(),
  quote: z.string().min(1, { error: "falta la cita del orden" }),
});

export const RouteStepSchema = z.strictObject({
  book: Slug,
  why: z
    .string()
    .min(1, { error: "falta el porqué del paso" })
    .max(ROUTE_LIMITS.why, { error: `why debe ser una frase corta (hasta ${ROUTE_LIMITS.why} caracteres)` }),
  /** Índice en `book.sources` de la cita que respalda el paso. */
  source: z.number().int().min(0).optional(),
  order: RouteOrderSchema.optional(),
  optional: z.literal(true, { error: "optional solo admite true (omitilo si el paso no es optativo)" }).optional(),
  /** Tramo a pie ANTES de este paso. */
  gap: GapSchema.optional(),
});

/** Un itinerario de lectura curado: corriente u objetivo, cruza temas. */
export const RouteSchema = z.strictObject({
  id: Slug,
  name: z.string().min(1).max(ROUTE_LIMITS.name, { error: `name debe tener hasta ${ROUTE_LIMITS.name} caracteres` }),
  kind: z.enum(ROUTE_KINDS, { error: 'kind debe ser "corriente" o "objetivo"' }),
  /** Tema de topics.yaml que da el color de la ruta. */
  line: Slug,
  promise: z.string().min(1).max(ROUTE_LIMITS.promise, { error: `promise debe tener hasta ${ROUTE_LIMITS.promise} caracteres` }),
  summary: z.string().min(1).max(ROUTE_LIMITS.summary, { error: `summary debe tener hasta ${ROUTE_LIMITS.summary} caracteres` }),
  steps: z
    .array(RouteStepSchema)
    .min(ROUTE_LIMITS.steps[0], { error: `una ruta necesita al menos ${ROUTE_LIMITS.steps[0]} pasos` })
    .max(ROUTE_LIMITS.steps[1], { error: `una ruta admite hasta ${ROUTE_LIMITS.steps[1]} pasos` }),
});

export const RoutesFileSchema = z.array(RouteSchema);

export type Route = z.infer<typeof RouteSchema>;
export type RouteStep = z.infer<typeof RouteStepSchema>;

interface RouteBook {
  id: string;
  sources?: readonly unknown[];
}

/** Invariantes de las rutas contra el catálogo: libros, sources, repetidos, primer paso y línea. */
export function checkRoutes(routes: readonly Route[], books: readonly RouteBook[], topicIds: ReadonlySet<string>, r: Reporter) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const seenRoutes = new Set<string>();
  for (const route of routes) {
    if (seenRoutes.has(route.id)) r.entity("ruta", route.id, "id repetido");
    seenRoutes.add(route.id);
    if (!topicIds.has(route.line)) r.at("ruta", route.id, "line", `el tema "${route.line}" no existe en topics.yaml`);
    const seenBooks = new Set<string>();
    route.steps.forEach((s, i) => {
      const at = (field: string, msg: string) => r.at("ruta", route.id, `steps[${i}] › ${field}`, msg);
      const book = byId.get(s.book);
      if (!book) at("book", `el libro "${s.book}" no existe en books.yaml`);
      if (seenBooks.has(s.book)) at("book", `"${s.book}" está repetido en la ruta`);
      seenBooks.add(s.book);
      if (book) {
        const n = book.sources?.length ?? 0;
        if (s.source === undefined && n > 0) {
          at("source", `falta; "${s.book}" tiene ${n} source${n === 1 ? "" : "s"} (${n === 1 ? "solo el 0" : `0 a ${n - 1}`}) y el paso debe citar una`);
        } else if (s.source !== undefined && s.source >= n) {
          at("source", `${s.source} está fuera de rango; "${s.book}" tiene ${n} source${n === 1 ? "" : "s"}${n ? ` (0 a ${n - 1})` : ""}`);
        }
      }
      if (i === 0 && s.gap) at("gap", "el primer paso no puede tener un tramo a pie antes");
      if (i === 0 && s.optional) at("optional", "el primer paso no puede ser optativo");
    });
  }
}
