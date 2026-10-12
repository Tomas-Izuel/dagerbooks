/**
 * Módulo `progression`: niveles con un único libro raíz (nivel 0), cadenas de prerrequisitos
 * (`leadsTo`) y tramos a pie (`gap`) cuando un salto no tiene libro intermedio.
 */
import * as z from "zod";
import { buildAdjacency, findCycle, type GraphNode } from "../graph";
import { GapSchema, Slug, type Gap } from "../primitives";
import type { Reporter } from "../report";

/** Un `leadsTo` es un id suelto o `{ id, gap }`. */
export const LeadsToItemSchema = z.union([Slug, z.strictObject({ id: Slug, gap: GapSchema })]);
export type LeadsToItem = z.infer<typeof LeadsToItemSchema>;

export const leadsToId = (item: LeadsToItem): string => (typeof item === "string" ? item : item.id);

/** Tramos a pie por id destino (solo las aristas anotadas). */
export function gapsByTarget(items: readonly LeadsToItem[] | undefined): Record<string, Gap> {
  const gaps: Record<string, Gap> = {};
  for (const item of items ?? []) if (typeof item !== "string") gaps[item.id] = item.gap;
  return gaps;
}

/**
 * Regla del catálogo: todo libro de nivel 1 cuelga implícitamente del libro raíz (nivel 0),
 * aunque no esté en su `leadsTo`. Devuelve nodos con esas aristas añadidas (sin duplicar).
 */
export function withImplicitRootEdges<T extends GraphNode & { level: number }>(nodes: readonly T[]): GraphNode[] {
  const root = nodes.find((n) => n.level === 0);
  if (!root) return [...nodes];
  const level1 = nodes.filter((n) => n.level === 1).map((n) => n.id);
  return nodes.map((n) =>
    n === root ? { id: n.id, leadsTo: [...new Set([...(n.leadsTo ?? []), ...level1])] } : { id: n.id, leadsTo: n.leadsTo },
  );
}

interface ProgressionBook {
  id: string;
  level: number;
  leadsTo?: LeadsToItem[];
}

export function checkProgression(books: readonly ProgressionBook[], r: Reporter) {
  const byId = new Map(books.map((b) => [b.id, b]));

  // exactamente un libro de nivel 0
  const roots = books.filter((b) => b.level === 0);
  if (roots.length !== 1) {
    r.catalog(
      "level",
      `debe haber exactamente un libro de nivel 0 (hay ${roots.length}: ${roots.map((x) => x.id).join(", ") || "ninguno"})`,
    );
  }

  for (const b of books) {
    (b.leadsTo ?? []).forEach((item, i) => {
      const target = leadsToId(item);
      const f = `leadsTo[${i}]`;
      const t = byId.get(target);
      if (!t) return void r.at("libro", b.id, f, `el libro "${target}" no existe`);
      if (target === b.id) return void r.at("libro", b.id, f, "no puede apuntar a sí mismo");
      // Un gap puede ir en un salto de 1 nivel: la zona es gruesa y el salto real se evalúa por arista.
      if (typeof item === "string" && t.level - b.level >= 2 && b.level > 0) {
        r.warnAt("libro", b.id, f, `salta ${t.level - b.level} niveles hasta "${target}" sin anotar tramo a pie (gap); revisá si falta`);
      }
      if (t.level <= b.level) {
        r.at("libro", b.id, f, `"${target}" (nivel ${t.level}) debe tener nivel mayor que "${b.id}" (nivel ${b.level})`);
      }
    });
    if (new Set((b.leadsTo ?? []).map(leadsToId)).size !== (b.leadsTo ?? []).length) {
      r.at("libro", b.id, "leadsTo", "hay ids repetidos");
    }
  }

  const edges = books.map((b) => ({ id: b.id, level: b.level, leadsTo: (b.leadsTo ?? []).map(leadsToId).filter((t) => byId.has(t)) }));
  const cycle = findCycle(edges);
  if (cycle) r.catalog("leadsTo", `ciclo detectado: ${cycle.join(" -> ")}`);

  // Avisos: libros sin cadena de prerrequisitos hacia el centro
  // (los libros de nivel 1 cuelgan implícitamente de la raíz, por eso quedan exentos)
  const adj = buildAdjacency(withImplicitRootEdges(edges));
  for (const b of books) {
    if (b.level !== 0 && b.level !== 1 && (adj.in.get(b.id) ?? []).length === 0) {
      r.warnAt("libro", b.id, "leadsTo", "ningún libro apunta a este (sin prerrequisito; no tiene cadena hacia el centro)");
    }
  }
}
