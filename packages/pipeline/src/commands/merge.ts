/**
 * Cruza las extracciones de los agentes en una propuesta para revisar:
 *   - libros ya en el catálogo (por `knownId` o por título): fuentes nuevas y postura agregada
 *   - libros nuevos agrupados por título: incluidos si la postura agregada es recommends o mixed
 * Salida: <datos>/proposals/<nombre>.json (para editar y pasar a write-books) y un .md legible.
 */
import fs from "node:fs";
import path from "node:path";
import type { Stance } from "@estantes/catalog";
import { dataPath, loadAppCatalog, type Context } from "../context";
import { readRegistry } from "../registry";
import { readState } from "../state";
import { readJson, writeJson } from "../lib/yaml-io";
import { clock, secs, titleKey } from "../lib/text";
import { ExtractionFileSchema, type ExtractedBook } from "../schemas";

export interface ProposedSource {
  url: string;
  title?: string;
  timestamp?: string;
  quote?: string;
  stance?: Stance;
}

export interface ProposedBook {
  /** Lo completa quien revisa (o el agente de enriquecimiento). */
  id: string | null;
  include: boolean;
  excludeReason?: string;
  title: string;
  authors: string[];
  stance: Stance;
  identificationConfidence: "low" | "medium" | "high";
  notes: string[];
  sources: ProposedSource[];
  // Campos del catálogo que se completan antes de escribir:
  titleEs?: string;
  year?: number;
  kind?: string;
  topics?: string[];
  level?: number;
  recommendation?: string;
  summary?: string;
  context?: string;
  isbn?: string;
  coverId?: number;
  asin?: Record<string, string>;
  /** Candidatos de Amazon cuando no hubo match exacto (los elige quien revisa). */
  asinCandidates?: { asin: string; title?: string; by?: string }[];
  openLibrary?: { work?: string };
}

export interface KnownUpdate {
  id: string;
  stance: Stance;
  newSources: ProposedSource[];
}

export interface Proposal {
  creator: string;
  generatedAt: string;
  files: string[];
  newBooks: ProposedBook[];
  knownUpdates: KnownUpdate[];
  routeOpinions: { source?: string; timestamp?: string; quote: string; summary?: string }[];
}

/** Postura agregada de varias menciones: recomienda > con reservas > critica (si no hay menciones neutras) > menciona. */
export function aggregateStance(stances: readonly Stance[]): Stance {
  const s = new Set(stances);
  if (s.has("recommends")) return "recommends";
  if (s.has("mixed")) return "mixed";
  if (s.has("criticizes") && !s.has("mentions")) return "criticizes";
  return "mentions";
}

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 } as const;

/** URL de una cita: YouTube con `&t=`; el resto, la URL de la fuente tal cual (el minuto queda como texto). */
export function sourceUrl(platformUrl: string | undefined, videoId: string | undefined, timestamp: string | undefined): string | undefined {
  if (videoId && /^[\w-]{11}$/.test(videoId) && (!platformUrl || /youtu/.test(platformUrl))) {
    const t = timestamp ? secs(timestamp) : NaN;
    return `https://www.youtube.com/watch?v=${videoId}${Number.isNaN(t) ? "" : `&t=${t}s`}`;
  }
  return platformUrl;
}

export interface MergeInput {
  file: string;
  books: ExtractedBook[];
  videoId?: string;
  routeOpinions?: Proposal["routeOpinions"];
}

export function mergeExtractions(
  inputs: readonly MergeInput[],
  catalog: { ids: ReadonlySet<string>; titleIndex: ReadonlyMap<string, string>; existingSpots: ReadonlyMap<string, ReadonlySet<string>> },
  sourceInfo: (id: string) => { url?: string; title?: string; ignoreWindows?: string[] } | undefined,
): Pick<Proposal, "newBooks" | "knownUpdates" | "routeOpinions"> {
  const known = new Map<string, { recs: ExtractedBook[]; sources: ProposedSource[] }>();
  const fresh = new Map<string, { recs: ExtractedBook[]; sources: ProposedSource[] }>();
  const spot = (url: string, ts?: string) => `${url.replace(/[?&]t=\d+s?/, "")}@${ts ?? ""}`;
  const routeOpinions: Proposal["routeOpinions"] = [];

  for (const input of inputs) {
    for (const op of input.routeOpinions ?? []) routeOpinions.push({ ...op, ...(input.videoId ? { source: input.videoId } : {}) });
    for (const rec of input.books) {
      const byKnown = rec.knownId && catalog.ids.has(rec.knownId) ? rec.knownId : undefined;
      const byTitle = catalog.titleIndex.get(titleKey(rec.title));
      const id = byKnown ?? byTitle;
      const bucket = id ? known : fresh;
      const key = id ?? titleKey(rec.title);
      const entry = bucket.get(key) ?? { recs: [], sources: [] };
      entry.recs.push(rec);
      for (const s of rec.sources) {
        const vid = s.videoId ?? input.videoId;
        const info = vid ? sourceInfo(vid) : undefined;
        if (s.timestamp && inWindows(s.timestamp, info?.ignoreWindows)) continue;
        const url = s.url ?? sourceUrl(info?.url, vid, s.timestamp);
        if (!url) continue;
        if (entry.sources.some((x) => spot(x.url, x.timestamp) === spot(url, s.timestamp))) continue;
        entry.sources.push({
          url,
          ...((s.videoTitle ?? info?.title) ? { title: s.videoTitle ?? info?.title } : {}),
          ...(s.timestamp ? { timestamp: clockOf(s.timestamp) } : {}),
          ...(s.quote ? { quote: s.quote } : {}),
          ...((s.stance ?? rec.stance) ? { stance: s.stance ?? rec.stance } : {}),
        });
      }
      bucket.set(key, entry);
    }
  }

  const stanceOf = (recs: ExtractedBook[]) =>
    aggregateStance([...recs.map((r) => r.stance), ...recs.flatMap((r) => r.sources.map((s) => s.stance).filter((x): x is Stance => !!x))]);

  const newBooks: ProposedBook[] = [...fresh.values()].map(({ recs, sources }) => {
    const stance = stanceOf(recs);
    const best = [...recs].sort((a, b) => CONFIDENCE_RANK[b.identificationConfidence] - CONFIDENCE_RANK[a.identificationConfidence] || b.authors.length - a.authors.length)[0];
    const confidence = recs.reduce<ProposedBook["identificationConfidence"]>(
      (min, r) => (CONFIDENCE_RANK[r.identificationConfidence] < CONFIDENCE_RANK[min] ? r.identificationConfidence : min),
      "high",
    );
    const include = stance === "recommends" || stance === "mixed";
    return {
      id: null,
      include,
      ...(include ? {} : { excludeReason: stance === "criticizes" ? "solo crítica o rechazo" : "solo mención o cita, sin recomendación" }),
      title: best.title,
      authors: best.authors,
      stance,
      identificationConfidence: confidence,
      notes: [...new Set(recs.map((r) => r.notes).filter((n): n is string => !!n))],
      sources,
    };
  });

  const knownUpdates: KnownUpdate[] = [...known.entries()]
    .map(([id, { recs, sources }]) => {
      const existing = catalog.existingSpots.get(id) ?? new Set<string>();
      return { id, stance: stanceOf(recs), newSources: sources.filter((s) => !existing.has(spot(s.url, s.timestamp))) };
    })
    .filter((u) => u.newSources.length);

  return { newBooks, knownUpdates, routeOpinions };
}

/** El minuto cae en alguno de los tramos a ignorar ("0:32:00-0:36:00"). */
export function inWindows(ts: string, windows: readonly string[] | undefined): boolean {
  const t = secs(ts);
  return (windows ?? []).some((w) => {
    const [from, to] = w.split("-").map((x) => secs(x.trim()));
    return t >= from && t <= to;
  });
}

/** "62:14" o "1:02:14" tal como vino; "3723" (segundos) → reloj. */
const clockOf = (ts: string) => (/^\d+$/.test(ts) ? clock(Number(ts)) : ts);

export async function mergeCommand(ctx: Context, opts: { dir?: string; name?: string; video?: string } = {}) {
  const dir = opts.dir ?? dataPath(ctx, "extractions");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const inputs: MergeInput[] = files.map((f) => {
    const data = readJson(path.join(dir, f), ExtractionFileSchema);
    return { file: f, books: data.books, videoId: data.videoId ?? opts.video, routeOpinions: data.routeOpinions };
  });

  const { catalog } = await loadAppCatalog(ctx);
  const registry = readRegistry(ctx);
  const ids = new Set(catalog.books.map((b) => b.id));
  const titleIndex = new Map<string, string>();
  for (const b of catalog.books) {
    titleIndex.set(titleKey(b.title), b.id);
    if (b.titleEs) titleIndex.set(titleKey(b.titleEs), b.id);
  }
  for (const w of registry.values()) if (ids.has(w.id) && w.titleEs) titleIndex.set(titleKey(w.titleEs), w.id);
  const existingSpots = new Map(
    catalog.books.map((b) => [b.id, new Set((b.sources ?? []).map((s) => `${s.url.replace(/[?&]t=\d+s?/, "")}@${s.timestamp ?? ""}`))]),
  );
  const state = readState(ctx);
  const info = new Map(state.sources.map((s) => [s.id, s]));

  const merged = mergeExtractions(inputs, { ids, titleIndex, existingSpots }, (id) => info.get(id));
  const proposal: Proposal = { creator: ctx.creator, generatedAt: new Date().toISOString(), files, ...merged };
  const name = opts.name ?? new Date().toISOString().slice(0, 10);
  const out = dataPath(ctx, "proposals", `${name}.json`);
  writeJson(out, proposal);
  fs.writeFileSync(out.replace(/\.json$/, ".md"), reviewMarkdown(proposal));
  console.log(
    `merge-extractions: ${files.length} archivo(s); ${proposal.newBooks.filter((b) => b.include).length} nuevos incluidos, ` +
      `${proposal.newBooks.filter((b) => !b.include).length} excluidos, ${proposal.knownUpdates.length} libros con fuentes nuevas → ${out}`,
  );
}

export function reviewMarkdown(p: Proposal): string {
  const L: string[] = [`# Propuesta para ${p.creator} (${p.generatedAt.slice(0, 10)})`, "", `Extracciones: ${p.files.join(", ")}`, ""];
  const inc = p.newBooks.filter((b) => b.include);
  L.push(`## Nuevos incluidos (${inc.length})`, "", "| Título | Autores | Postura | Identificación | Fuentes |", "|---|---|---|---|---|");
  for (const b of inc) L.push(`| ${b.title} | ${b.authors.slice(0, 3).join(", ")} | ${b.stance} | ${b.identificationConfidence} | ${b.sources.length} |`);
  const byReason = new Map<string, ProposedBook[]>();
  for (const b of p.newBooks.filter((x) => !x.include)) byReason.set(b.excludeReason ?? "?", [...(byReason.get(b.excludeReason ?? "?") ?? []), b]);
  L.push("", "## Excluidos", "");
  for (const [reason, books] of byReason) {
    L.push(`### ${reason} (${books.length})`, "");
    for (const b of books) L.push(`- ${b.title}${b.authors.length ? ` (${b.authors.slice(0, 2).join(", ")})` : ""}`);
    L.push("");
  }
  L.push(`## Fuentes nuevas para libros del catálogo (${p.knownUpdates.length})`, "");
  for (const u of p.knownUpdates) L.push(`- **${u.id}** (${u.stance}): ${u.newSources.length} fuente(s)`);
  if (p.routeOpinions.length) {
    L.push("", `## Opiniones sobre el orden de lectura (${p.routeOpinions.length})`, "");
    for (const o of p.routeOpinions) L.push(`- ${o.source ? `${o.source} ` : ""}${o.timestamp ?? ""}: "${o.quote}"${o.summary ? ` (${o.summary})` : ""}`);
  }
  return L.join("\n") + "\n";
}
