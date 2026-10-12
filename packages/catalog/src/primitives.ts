import * as z from "zod";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const Slug = z.string().regex(SLUG_RE, {
  error: "debe ser un slug en kebab-case (a-z, 0-9 y guiones)",
});

export const KINDS = ["book", "essay", "paper", "course", "textbook"] as const;

/**
 * Juicio editorial sobre un libro, de más a menos. Las claves son estables (van en URLs);
 * los textos los pone cada app. Una app puede usar un subconjunto.
 */
export const RECOMMENDATION_LEVELS = ["fuerte", "interesante", "mencion", "desaconseja"] as const;
export type Recommendation = (typeof RECOMMENDATION_LEVELS)[number];
export const RECOMMENDATION_RANK: Record<Recommendation, number> = { fuerte: 2, interesante: 1, mencion: 0, desaconseja: -1 };

/** Postura del creador en UNA mención (evidencia), distinta del juicio sobre el libro. */
export const STANCES = ["recommends", "mixed", "mentions", "criticizes"] as const;
export type Stance = (typeof STANCES)[number];

export const RelatedSchema = z.strictObject({
  id: Slug,
  reason: z.string().min(1, { error: "falta la razón de la relación" }),
});

export const GAP_SEVERITIES = ["fuerte", "muy-fuerte"] as const;

/** Tramo a pie: el salto entre dos libros no tiene parada en la red del creador. */
export const GapSchema = z.strictObject({
  severity: z.enum(GAP_SEVERITIES, { error: 'severity debe ser "fuerte" o "muy-fuerte"' }),
  bridge: z
    .array(z.string().min(1).max(80, { error: "cada tema del puente debe ser una frase corta" }))
    .min(1, { error: "bridge necesita al menos 1 tema" })
    .max(5, { error: "bridge admite hasta 5 temas" }),
  note: z.string().min(1).max(200, { error: "note debe ser una sola frase corta" }).optional(),
});

export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "date debe ser YYYY-MM-DD" })
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), {
    error: "date no es una fecha válida",
  });

export type Gap = z.infer<typeof GapSchema>;
export type GapSeverity = Gap["severity"];
export type Related = z.infer<typeof RelatedSchema>;
