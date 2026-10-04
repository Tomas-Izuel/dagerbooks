import { findCycle, buildAdjacency, withImplicitRootEdges } from "./graph";
import type { RawBook, Topic } from "./schema";

export interface InvariantResult {
  errors: string[];
  warnings: string[];
}

const at = (id: string, field: string, msg: string) => `libro "${id}" › ${field}: ${msg}`;

export function checkInvariants(books: readonly RawBook[], topics: readonly Topic[]): InvariantResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ids únicos
  const byId = new Map<string, RawBook>();
  for (const b of books) {
    if (byId.has(b.id)) errors.push(at(b.id, "id", "id duplicado"));
    byId.set(b.id, b);
  }
  const topicIds = new Set<string>();
  for (const t of topics) {
    if (topicIds.has(t.id)) errors.push(`tema "${t.id}" › id: id duplicado`);
    topicIds.add(t.id);
  }

  // exactamente un libro de nivel 0
  const roots = books.filter((b) => b.level === 0);
  if (roots.length !== 1) {
    errors.push(
      `catálogo › level: debe haber exactamente un libro de nivel 0 (hay ${roots.length}: ${roots.map((r) => r.id).join(", ") || "ninguno"})`,
    );
  }

  for (const b of books) {
    b.topics.forEach((t, i) => {
      if (!topicIds.has(t)) {
        errors.push(at(b.id, `topics[${i}]`, `el tema "${t}" no existe en topics.yaml`));
      }
    });

    (b.leadsTo ?? []).forEach((target, i) => {
      const f = `leadsTo[${i}]`;
      const t = byId.get(target);
      if (!t) return void errors.push(at(b.id, f, `el libro "${target}" no existe`));
      if (target === b.id) return void errors.push(at(b.id, f, "no puede apuntar a sí mismo"));
      if (t.level <= b.level) {
        errors.push(
          at(b.id, f, `"${target}" (nivel ${t.level}) debe tener nivel mayor que "${b.id}" (nivel ${b.level})`),
        );
      }
    });
    if (new Set(b.leadsTo ?? []).size !== (b.leadsTo ?? []).length) {
      errors.push(at(b.id, "leadsTo", "hay ids repetidos"));
    }

    (b.related ?? []).forEach((r, i) => {
      const f = `related[${i}].id`;
      if (!byId.has(r.id)) errors.push(at(b.id, f, `el libro "${r.id}" no existe`));
      else if (r.id === b.id) errors.push(at(b.id, f, "no puede relacionarse consigo mismo"));
      else if (byId.get(r.id)?.related?.some((x) => x.id === b.id) && b.id > r.id) {
        warnings.push(at(b.id, f, `el par ${b.id} <-> ${r.id} está declarado en ambos libros; declaralo una sola vez`));
      }
    });
  }

  const cycle = findCycle(books.filter((b) => byId.has(b.id)).map((b) => ({
    id: b.id,
    leadsTo: (b.leadsTo ?? []).filter((t) => byId.has(t)),
  })));
  if (cycle) errors.push(`catálogo › leadsTo: ciclo detectado: ${cycle.join(" -> ")}`);

  // Avisos: libros sin cadena de prerrequisitos hacia el centro
  // (los libros de nivel 1 cuelgan implícitamente de la raíz, por eso quedan exentos)
  const adj = buildAdjacency(
    withImplicitRootEdges(books.map((b) => ({ id: b.id, level: b.level, leadsTo: (b.leadsTo ?? []).filter((t) => byId.has(t)) }))),
  );
  for (const b of books) {
    if (b.level !== 0 && b.level !== 1 && (adj.in.get(b.id) ?? []).length === 0) {
      warnings.push(at(b.id, "leadsTo", "ningún libro apunta a este (sin prerrequisito; no tiene cadena hacia el centro)"));
    }
  }

  return { errors, warnings };
}
