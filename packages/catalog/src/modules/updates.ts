/** Módulo `updates`: novedades del sitio (libros nuevos, de qué stream o video salen, y mejoras). */
import * as z from "zod";
import { IsoDate, Slug } from "../primitives";
import type { Reporter } from "../report";

export const UPDATE_LIMITS = { title: 70, streamTitle: 120, improvement: 140, improvements: 5 } as const;

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
  /** Ids de los libros agregados en esta actualización (deben existir en el catálogo). */
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
export type SiteUpdate = z.infer<typeof UpdateSchema>;

export function checkUpdates(updates: readonly SiteUpdate[], bookIds: ReadonlySet<string>, r: Reporter) {
  const seen = new Set<string>();
  for (const u of updates) {
    if (seen.has(u.id)) r.entity("actualización", u.id, "id repetido");
    seen.add(u.id);
    const own = new Set<string>();
    (u.books ?? []).forEach((id, i) => {
      if (!bookIds.has(id)) r.at("actualización", u.id, `books[${i}]`, `el libro "${id}" no existe`);
      if (own.has(id)) r.at("actualización", u.id, `books[${i}]`, `"${id}" está repetido`);
      own.add(id);
    });
  }
}

/** Más nueva primero; a igual fecha se respeta el orden de lectura (sort estable). */
export const sortUpdates = <T extends { date: string }>(updates: T[]): T[] => updates.sort((a, b) => b.date.localeCompare(a.date));
