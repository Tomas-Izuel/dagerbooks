/** Invariantes y derivaciones del núcleo: ids, temas (árbol de dos niveles), relaciones, confianza. */
import type { Book, CatalogDef, MissingField, RawBook, Topic } from "./define";
import { gapsByTarget, leadsToId } from "./modules/progression";
import type { Recommendation } from "./primitives";
import type { Reporter } from "./report";

export function checkCore(books: readonly RawBook<string>[], topics: readonly Topic[], r: Reporter) {
  // ids únicos
  const byId = new Map<string, RawBook<string>>();
  for (const b of books) {
    if (byId.has(b.id)) r.at("libro", b.id, "id", "id duplicado");
    byId.set(b.id, b);
  }
  const topicById = new Map<string, Topic>();
  for (const t of topics) {
    if (topicById.has(t.id)) r.at("tema", t.id, "id", "id duplicado");
    topicById.set(t.id, t);
  }

  // Árbol de temas: como mucho dos niveles.
  const parents = new Set<string>();
  for (const t of topics) {
    if (t.parent === undefined) continue;
    const p = topicById.get(t.parent);
    if (t.parent === t.id) r.at("tema", t.id, "parent", "no puede ser su propio padre");
    else if (!p) r.at("tema", t.id, "parent", `el tema "${t.parent}" no existe en topics.yaml`);
    else if (p.parent !== undefined) r.at("tema", t.id, "parent", `"${t.parent}" ya es subtema de "${p.parent}"; los temas admiten dos niveles`);
    else parents.add(t.parent);
  }

  const seqs = new Map<number, string>();
  for (const b of books) {
    b.topics.forEach((t, i) => {
      if (!topicById.has(t)) r.at("libro", b.id, `topics[${i}]`, `el tema "${t}" no existe en topics.yaml`);
      else if (parents.has(t)) r.at("libro", b.id, `topics[${i}]`, `el tema "${t}" tiene subtemas; usá uno de ellos`);
    });

    (b.related ?? []).forEach((rel, i) => {
      const f = `related[${i}].id`;
      if (!byId.has(rel.id)) r.at("libro", b.id, f, `el libro "${rel.id}" no existe`);
      else if (rel.id === b.id) r.at("libro", b.id, f, "no puede relacionarse consigo mismo");
      else if (byId.get(rel.id)?.related?.some((x) => x.id === b.id) && b.id > rel.id) {
        r.warnAt("libro", b.id, f, `el par ${b.id} <-> ${rel.id} está declarado en ambos libros; declaralo una sola vez`);
      }
    });

    if (b.seq !== undefined) {
      const other = seqs.get(b.seq);
      if (other) r.warnAt("libro", b.id, "seq", `comparte seq ${b.seq} con "${other}"; se desempata por id`);
      else seqs.set(b.seq, b.id);
    }
  }
}

/**
 * Juicio sobre el libro cuando el YAML no lo declara, a partir de la postura de cada mención.
 * Sin menciones con postura vale "interesante" (lo que el catálogo asumió siempre).
 */
export function deriveRecommendation<R extends string>(sources: RawBook["sources"], allowed: readonly R[]): R {
  const pick = (want: Recommendation, fallback: Recommendation): R =>
    ((allowed as readonly string[]).includes(want) ? want : fallback) as R;
  const stances = (sources ?? []).map((s) => s.stance).filter((s) => s !== undefined);
  if (!stances.length || stances.some((s) => s === "recommends" || s === "mixed")) return pick("interesante", "interesante");
  if (stances.every((s) => s === "criticizes")) return pick("desaconseja", "mencion");
  return pick("mencion", "mencion");
}

/** Normaliza un libro validado: confianza, faltantes, juicio, sector y (con progression) aristas y tramos. */
export function deriveBook<R extends string>(b: RawBook<R>, def: CatalogDef): Book<R> {
  const missing: MissingField[] = [];
  if (!b.authors?.length) missing.push("authors");
  if (!b.summary) missing.push("summary");
  if (!b.context) missing.push("context");
  if (!b.sources?.length) missing.push("sources");
  const progression = def.modules.progression;
  // `seq` solo ordena la carga; el orden del array ya lo expresa.
  const { seq: _seq, ...rest } = b;
  void _seq;
  return {
    ...rest,
    recommendation: b.recommendation ?? deriveRecommendation(b.sources, def.recommendations as readonly string[] as readonly R[]),
    leadsTo: progression ? b.leadsTo?.map(leadsToId) : undefined,
    gaps: progression ? gapsByTarget(b.leadsTo) : {},
    confidence: b.confidence ?? (missing.length ? "low" : "high"),
    missing,
    primaryTopic: b.topics[0] ?? null,
  };
}
