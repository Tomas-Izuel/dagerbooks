import * as z from "zod";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const KINDS = ["book", "essay", "paper", "course", "textbook"] as const;

export const RECOMMENDATION_LEVELS = ["fuerte", "interesante", "mencion"] as const;
export type Recommendation = (typeof RECOMMENDATION_LEVELS)[number];

export const RECOMMENDATION_LABELS: Record<Recommendation, { label: string; description: string }> = {
  fuerte: { label: "Lo súper recomienda", description: "Lectura imprescindible o favorita: insiste en que la lean." },
  interesante: { label: "Ideas interesantes", description: "Lo valora o lo recomienda con reservas; tiene ideas que le sirven." },
  mencion: { label: "Mención curiosa", description: "Lo cita o lo nombra, pero no lo recomienda." },
};

export const LEVEL_LABELS: Record<number, string> = {
  0: "Raíz",
  1: "Introductorio",
  2: "Intermedio",
  3: "Avanzado",
  4: "Especialista",
};

const Slug = z.string().regex(SLUG_RE, {
  error: "debe ser un slug en kebab-case (a-z, 0-9 y guiones)",
});

export const SourceSchema = z.strictObject({
  url: z.url({ error: "url inválida" }),
  title: z.string().min(1).optional(),
  timestamp: z.string().min(1).optional(),
  quote: z.string().min(1).optional(),
  confidence: z.enum(["low", "high"]).optional(),
});

export const RelatedSchema = z.strictObject({
  id: Slug,
  reason: z.string().min(1, { error: "falta la razón de la relación" }),
});

export const GAP_SEVERITIES = ["fuerte", "muy-fuerte"] as const;

/** Tramo a pie: el salto entre dos libros no tiene parada en la red de Dager. */
export const GapSchema = z.strictObject({
  severity: z.enum(GAP_SEVERITIES, { error: 'severity debe ser "fuerte" o "muy-fuerte"' }),
  bridge: z
    .array(z.string().min(1).max(80, { error: "cada tema del puente debe ser una frase corta" }))
    .min(1, { error: "bridge necesita al menos 1 tema" })
    .max(5, { error: "bridge admite hasta 5 temas" }),
  note: z.string().min(1).max(200, { error: "note debe ser una sola frase corta" }).optional(),
});

/** Un `leadsTo` es un id suelto o `{ id, gap }`. */
export const LeadsToItemSchema = z.union([Slug, z.strictObject({ id: Slug, gap: GapSchema })]);

export const BookSchema = z
  .strictObject({
    id: Slug,
    title: z.string().min(1, { error: "title es obligatorio" }),
    titleEs: z.string().min(1).optional(),
    authors: z.array(z.string().min(1)).optional(),
    year: z.number().int().min(-1000).max(2100).optional(),
    kind: z.enum(KINDS).optional(),
    topics: z.array(Slug),
    level: z
      .number({ error: "level es obligatorio y debe ser un número" })
      .int()
      .min(0)
      .max(4),
    summary: z.string().min(1).optional(),
    context: z.string().min(1).optional(),
    sources: z.array(SourceSchema).optional(),
    leadsTo: z.array(LeadsToItemSchema).optional(),
    related: z.array(RelatedSchema).optional(),
    isbn: z.string().regex(/^\d{9}[\dXx]$|^\d{13}$/, { error: "isbn inválido" }).optional(),
    coverId: z.number().int().positive().optional(),
    /** Código de Amazon (10 caracteres) para el link de compra en amazon.es. */
    asin: z.string().regex(/^[A-Z0-9]{10}$/, { error: "asin inválido (10 caracteres A-Z0-9)" }).optional(),
    recommendation: z.enum(RECOMMENDATION_LEVELS).optional(),
    // Se calcula en build; solo se declara a mano para forzarlo.
    confidence: z.enum(["low", "high"]).optional(),
  })
  .check((ctx) => {
    const b = ctx.value;
    if (b.level !== 0 && b.topics.length === 0) {
      ctx.issues.push({
        code: "custom",
        input: b.topics,
        path: ["topics"],
        message: "debe tener al menos un tema (solo el nivel 0 puede no tenerlo)",
      });
    }
    if (new Set(b.topics).size !== b.topics.length) {
      ctx.issues.push({
        code: "custom",
        input: b.topics,
        path: ["topics"],
        message: "hay temas repetidos",
      });
    }
  });

export const BooksFileSchema = z.array(BookSchema);

export const TopicSchema = z.strictObject({
  id: Slug,
  name: z.string().min(1),
  description: z.string().min(1),
});

export const TopicsFileSchema = z.array(TopicSchema);

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "date debe ser YYYY-MM-DD" })
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), {
    error: "date no es una fecha válida",
  });

export const UPDATE_LIMITS = { title: 70, streamTitle: 120, improvement: 140, improvements: 5 } as const;

/** Una actualización del sitio: libros nuevos (y de qué stream salen) y mejoras. */
export const UpdateSchema = z.strictObject({
  id: Slug,
  date: IsoDate,
  title: z.string().min(1).max(UPDATE_LIMITS.title, { error: `title debe ser corto (hasta ${UPDATE_LIMITS.title} caracteres)` }),
  stream: z
    .strictObject({
      title: z.string().min(1).max(UPDATE_LIMITS.streamTitle),
      url: z.url({ error: "url inválida" }),
    })
    .optional(),
  /** Ids de los libros agregados en esta actualización (deben existir en books.yaml). */
  books: z.array(Slug).optional(),
  improvements: z
    .array(
      z.string().min(1).max(UPDATE_LIMITS.improvement, {
        error: `cada mejora debe ser una frase corta (hasta ${UPDATE_LIMITS.improvement} caracteres)`,
      }),
    )
    .min(1, { error: "improvements necesita al menos 1 frase" })
    .max(UPDATE_LIMITS.improvements, { error: `improvements admite hasta ${UPDATE_LIMITS.improvements} frases` }),
});

export const UpdatesFileSchema = z.array(UpdateSchema);

export const ROUTE_KINDS = ["corriente", "objetivo"] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];
export const ROUTE_KIND_LABELS: Record<RouteKind, string> = { corriente: "Corriente", objetivo: "Objetivo" };

export const ROUTE_LIMITS = { name: 40, promise: 140, summary: 320, why: 160, steps: [4, 10] } as const;

/** Evidencia de que Dager dictó el orden de este paso (video o stream). */
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

/** Un itinerario de lectura curado: corriente u objetivo, cruza líneas del mapa. */
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

export type SiteUpdate = z.infer<typeof UpdateSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type RawBook = z.infer<typeof BookSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type MissingField = "authors" | "summary" | "context" | "sources";

export type Gap = z.infer<typeof GapSchema>;
export type GapSeverity = Gap["severity"];
export type LeadsToItem = z.infer<typeof LeadsToItemSchema>;

export const leadsToId = (item: LeadsToItem): string => (typeof item === "string" ? item : item.id);

export type Book = Omit<RawBook, "confidence" | "recommendation" | "leadsTo"> & {
  /** Ids destino (normalizado desde `leadsTo`). */
  leadsTo?: string[];
  /** Tramos a pie por id destino (solo las aristas anotadas). */
  gaps: Record<string, Gap>;
  confidence: "low" | "high";
  /** Nivel de recomendación de Dager; "interesante" si el YAML no lo declara. No cuenta para "por completar". */
  recommendation: Recommendation;
  /** Campos faltantes que causan confidence "low" (vacío si se forzó). */
  missing: MissingField[];
  /** Primer tema = sector; null para la raíz. */
  primaryTopic: string | null;
};
