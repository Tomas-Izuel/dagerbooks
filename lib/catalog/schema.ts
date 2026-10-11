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
