/** De la propuesta revisada al catálogo: metadata (Open Library, Amazon), archivos de libro, registro y estado. */
import fs from "node:fs";
import { loadCatalogFrom } from "@estantes/catalog/node";
import { dataPath, loadAppCatalog, loadCatalogDef, loadCreator, type Context } from "../context";
import { Amazon, isbn10 } from "../adapters/amazon";
import { OL_LANG, OpenLibrary, pickEdition } from "../adapters/openlibrary";
import { appendSources, bookFile, maxSeq, newBookDoc, readBookDoc, setField, writeDoc } from "../lib/books-io";
import { youtubeId } from "../lib/text";
import { mergeWork, readRegistry, writeWork } from "../registry";
import { readState, upsertSource, writeState } from "../state";
import type { Proposal, ProposedBook } from "./merge";

const readProposal = (file: string): Proposal => JSON.parse(fs.readFileSync(file, "utf8")) as Proposal;
const saveProposal = (file: string, p: Proposal) => fs.writeFileSync(file, JSON.stringify(p, null, 1) + "\n");
const wanted = (b: ProposedBook) => b.include;

/** Completa año, tapa, obra de Open Library e ISBN (en el idioma del sitio si hay, si no en inglés). */
export async function enrich(ctx: Context, proposalFile: string) {
  const creator = await loadCreator(ctx);
  const ol = new OpenLibrary(dataPath(ctx, "cache", "openlibrary.json"));
  const p = readProposal(proposalFile);
  const langs = [...new Set([OL_LANG[creator.voice.language] ?? "eng", "eng"])];
  let done = 0;
  for (const b of p.newBooks.filter(wanted)) {
    if (b.isbn && b.coverId && b.year) continue;
    const author = b.authors[0]?.split(" ").slice(-1)[0];
    const docs = await ol.search(b.title.split(":")[0], author);
    const doc = docs[0];
    if (!doc) {
      console.warn(`  sin match en Open Library: ${b.title}`);
      continue;
    }
    b.openLibrary = { work: doc.key };
    b.year ??= doc.first_publish_year;
    b.coverId ??= doc.cover_i;
    if (!b.isbn) {
      const editions = (await Promise.all(docs.slice(0, 2).map((d) => ol.editions(d.key)))).flat();
      const pick = await pickEdition(ol, editions, langs, b.title.split(":")[0]);
      if (pick) {
        b.isbn = pick.isbn;
        if (pick.lang === OL_LANG[creator.voice.language] && pick.lang !== "eng" && !b.titleEs) b.titleEs = pick.title;
      }
    }
    done++;
    saveProposal(proposalFile, p);
  }
  console.log(`enrich: ${done} libro(s) completados desde Open Library`);
}

/** ASIN en la tienda del sitio: por ISBN si la ficha existe; si no, candidatos de búsqueda para revisar. */
export async function asin(ctx: Context, proposalFile: string, marketplaceArg?: string) {
  const creator = await loadCreator(ctx);
  const marketplace = marketplaceArg ?? creator.affiliate?.marketplace ?? "es";
  const amazon = new Amazon(marketplace, dataPath(ctx, "cache", "amazon"));
  const p = readProposal(proposalFile);
  let found = 0;
  for (const b of p.newBooks.filter(wanted)) {
    if (b.asin?.[marketplace]) continue;
    if (b.kind && !["book", "textbook"].includes(b.kind) && !b.isbn) continue;
    const dp = b.isbn ? amazon.dp(isbn10(b.isbn)) : undefined;
    if (dp?.ok) {
      b.asin = { ...b.asin, [marketplace]: dp.asin };
      found++;
    } else {
      b.asinCandidates = amazon.search(`${b.title} ${b.authors.slice(0, 2).join(" ")}`).slice(0, 5);
    }
    saveProposal(proposalFile, p);
  }
  console.log(`asin: ${found} por ISBN; el resto quedó con candidatos en la propuesta (asinCandidates)`);
}

const REQUIRED = ["id", "title", "topics", "level"] as const;

/** Escribe los libros nuevos incluidos y suma las fuentes nuevas a los existentes; actualiza registro y estado. */
export async function writeBooks(ctx: Context, proposalFile: string, opts: { dry?: boolean } = {}) {
  const creator = await loadCreator(ctx);
  const marketplace = creator.affiliate?.marketplace ?? "es";
  const p = readProposal(proposalFile);
  const { catalog } = await loadAppCatalog(ctx);
  const existing = new Set(catalog.books.map((b) => b.id));
  const problems: string[] = [];
  let seq = maxSeq(ctx.contentDir);
  const written: string[] = [];
  const touched: string[] = [];

  for (const b of p.newBooks.filter(wanted)) {
    const missing = REQUIRED.filter((k) => b[k] === undefined || b[k] === null);
    if (missing.length) {
      problems.push(`"${b.title}": falta ${missing.join(", ")} (completalo en la propuesta)`);
      continue;
    }
    if (existing.has(b.id!)) {
      problems.push(`"${b.title}": el id "${b.id}" ya existe; pasalo a knownUpdates o elegí otro id`);
      continue;
    }
    const doc = newBookDoc({
      id: b.id,
      seq: ++seq,
      title: b.title,
      titleEs: b.titleEs,
      authors: b.authors,
      year: b.year,
      kind: b.kind,
      topics: b.topics,
      level: b.level,
      recommendation: b.recommendation,
      summary: b.summary,
      context: b.context,
      sources: b.sources,
      isbn: b.isbn,
      asin: b.asin && Object.keys(b.asin).length ? b.asin : undefined,
      coverId: b.coverId,
    });
    if (!opts.dry) writeDoc(bookFile(ctx.contentDir, b.id!), doc);
    written.push(b.id!);
  }

  for (const u of p.knownUpdates) {
    if (!existing.has(u.id)) {
      problems.push(`knownUpdates: "${u.id}" no existe en el catálogo`);
      continue;
    }
    const file = bookFile(ctx.contentDir, u.id);
    const doc = readBookDoc(file);
    appendSources(doc, u.newSources as unknown as Record<string, unknown>[]);
    if (!opts.dry) writeDoc(file, doc);
    touched.push(u.id);
  }

  if (problems.length) console.warn(`write-books: ${problems.length} problema(s):\n${problems.map((x) => `  - ${x}`).join("\n")}`);
  if (opts.dry) {
    console.log(`write-books (dry): escribiría ${written.length} libro(s) nuevo(s) y sumaría fuentes a ${touched.length}`);
    return;
  }

  // El catálogo tiene que seguir validando; si no, se informa y no se toca registro ni estado.
  try {
    loadCatalogFrom(await loadCatalogDef(ctx), ctx.contentDir);
  } catch (e) {
    console.error(`write-books: el catálogo no valida después de escribir. Corregí y volvé a correr \`pnpm validate\`.\n${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const registry = readRegistry(ctx);
  for (const b of p.newBooks.filter((x) => wanted(x) && written.includes(x.id!))) {
    writeWork(
      ctx,
      mergeWork(registry.get(b.id!), {
        id: b.id!,
        title: b.title,
        ...(b.authors.length ? { authors: b.authors } : {}),
        ...(b.year ? { year: b.year } : {}),
        ...(b.kind ? { kind: b.kind } : {}),
        ...(b.openLibrary?.work || b.coverId ? { openLibrary: { ...(b.openLibrary?.work ? { work: b.openLibrary.work } : {}), ...(b.coverId ? { coverId: b.coverId } : {}) } } : {}),
        ...(b.isbn ? { editions: [{ isbn: b.isbn }] } : {}),
        ...(b.asin?.[marketplace] ? { asin: { [marketplace]: b.asin[marketplace] } } : {}),
        ...(b.titleEs ? { titleEs: b.titleEs } : {}),
      }),
    );
  }
  const state = readState(ctx);
  const cited = new Set(
    [...p.newBooks.filter((x) => wanted(x) && written.includes(x.id!)).flatMap((x) => x.sources), ...p.knownUpdates.flatMap((u) => u.newSources)]
      .map((s) => youtubeId(s.url))
      .filter((x): x is string => !!x),
  );
  for (const s of state.sources) if (cited.has(s.id)) upsertSource(state, { ...s, status: "merged" });
  writeState(ctx, state);
  console.log(`write-books: ${written.length} libro(s) nuevo(s), fuentes sumadas a ${touched.length}; registro y estado al día`);
}

/** Diferencias entre el registro (fuente de verdad de la metadata) y los libros de la app. */
export async function syncMetadata(ctx: Context, opts: { apply?: boolean } = {}) {
  const creator = await loadCreator(ctx);
  const marketplace = creator.affiliate?.marketplace ?? "es";
  const { catalog } = await loadAppCatalog(ctx);
  const registry = readRegistry(ctx);
  const diffs: { id: string; field: string; app: unknown; registry: unknown }[] = [];
  for (const b of catalog.books) {
    const w = registry.get(b.id);
    if (!w) continue;
    const want: Record<string, unknown> = {
      year: w.year,
      coverId: w.openLibrary?.coverId,
      isbn: w.editions?.[0]?.isbn,
      titleEs: w.titleEs,
      authors: w.authors,
      asin: w.asin?.[marketplace as keyof typeof w.asin] ? { ...b.asin, [marketplace]: w.asin[marketplace as keyof typeof w.asin] } : undefined,
    };
    const have: Record<string, unknown> = { year: b.year, coverId: b.coverId, isbn: b.isbn, titleEs: b.titleEs, authors: b.authors, asin: b.asin };
    for (const [field, value] of Object.entries(want)) {
      if (value === undefined) continue;
      if (JSON.stringify(value) !== JSON.stringify(have[field])) diffs.push({ id: b.id, field, app: have[field], registry: value });
    }
  }
  for (const d of diffs) console.log(`  ${d.id} › ${d.field}: ${JSON.stringify(d.app)} → ${JSON.stringify(d.registry)}`);
  if (opts.apply) {
    const byId = new Map<string, typeof diffs>();
    for (const d of diffs) byId.set(d.id, [...(byId.get(d.id) ?? []), d]);
    for (const [id, ds] of byId) {
      const file = bookFile(ctx.contentDir, id);
      const doc = readBookDoc(file);
      for (const d of ds) setField(doc, d.field, d.registry);
      writeDoc(file, doc);
    }
  }
  console.log(`sync-metadata: ${diffs.length} diferencia(s)${opts.apply ? " aplicadas" : " (con --apply se escriben)"}`);
}
