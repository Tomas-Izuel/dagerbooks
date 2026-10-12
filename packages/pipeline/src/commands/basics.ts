/** Comandos básicos: estado, libros conocidos (para los prompts) y registro inicial desde la app. */
import fs from "node:fs";
import path from "node:path";
import { loadAppCatalog, type Context } from "../context";
import { readRegistry, mergeWork, writeWork } from "../registry";
import { readState, upsertSource, writeState } from "../state";
import { secs, today, youtubeId } from "../lib/text";
import type { State, Work } from "../schemas";

export function stateSummary(ctx: Context) {
  const state = readState(ctx);
  const counts = new Map<string, number>();
  for (const s of state.sources) counts.set(`${s.platform}:${s.status}`, (counts.get(`${s.platform}:${s.status}`) ?? 0) + 1);
  console.log(`Estado de ${ctx.creator} (${path.relative(ctx.root, ctx.statePath)})`);
  for (const [k, n] of [...counts].sort()) console.log(`  ${k.padEnd(28)} ${n}`);
  const open = state.issues.filter((i) => i.status === "open");
  console.log(`  issues abiertos: ${open.length}; resueltos: ${state.issues.length - open.length}`);
  console.log(`  pistas de ASR: ${Object.keys(state.asrHints).length}; datos en ${ctx.dataDir}`);
}

/** TSV id, nivel, tema primario, título, autores: lo que los prompts usan como libros conocidos. */
export async function knownBooks(ctx: Context): Promise<string> {
  const { catalog } = await loadAppCatalog(ctx);
  return catalog.books
    .map((b) => [b.id, b.level, b.primaryTopic ?? "-", b.title, (b.authors ?? []).join(", ")].join("\t"))
    .join("\n");
}

/** Registro bibliográfico a partir de los libros de la app (completa huecos; no pisa lo verificado). */
export async function registryInit(ctx: Context): Promise<{ written: number }> {
  const { catalog } = await loadAppCatalog(ctx);
  const registry = readRegistry(ctx);
  let written = 0;
  for (const b of catalog.books) {
    const work: Work = {
      id: b.id,
      title: b.title,
      ...(b.authors?.length ? { authors: b.authors } : {}),
      ...(b.year !== undefined ? { year: b.year } : {}),
      ...(b.kind ? { kind: b.kind } : {}),
      ...(b.coverId ? { openLibrary: { coverId: b.coverId } } : {}),
      ...(b.isbn ? { editions: [{ isbn: b.isbn }] } : {}),
      ...(b.asin && Object.keys(b.asin).length ? { asin: b.asin } : {}),
      ...(b.titleEs ? { titleEs: b.titleEs } : {}),
    };
    const next = mergeWork(registry.get(b.id), work);
    if (JSON.stringify(next) !== JSON.stringify(registry.get(b.id))) {
      writeWork(ctx, next);
      written++;
    }
  }
  return { written };
}

const readLines = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : []);

/**
 * Importa el estado implícito de una carpeta de research anterior a la pipeline:
 *   videos-*.tsv / shorts-*.tsv  metadatos (id, duración, título) y canal
 *   all-ids.txt                  descubiertos
 *   txt/<id>.txt                 transcriptos
 *   done-extract-ids.txt y videosRead de las carpetas extract…  extraídos
 *   no-transcript-ids.txt        salteados
 *   ids citados en el catálogo   incorporados (merged)
 */
export async function importLegacyState(ctx: Context, legacyDir: string, extra: Partial<Pick<State, "asrHints">> = {}) {
  const state = readState(ctx);
  const meta = new Map<string, { channel: string; duration?: number; title: string; short: boolean }>();
  for (const name of fs.readdirSync(legacyDir)) {
    const m = /^(videos|shorts)-(.+)\.tsv$/.exec(name);
    if (!m) continue;
    for (const line of readLines(path.join(legacyDir, name))) {
      const [id, dur, ...title] = line.split("\t");
      const d = secs(dur ?? "");
      meta.set(id, { channel: m[2], duration: Number.isNaN(d) ? undefined : d, title: title.join("\t"), short: m[1] === "shorts" });
    }
  }
  const base = (id: string) => {
    const m = meta.get(id);
    return {
      id,
      platform: "youtube" as const,
      url: m?.short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      ...(m ? { channel: m.channel, title: m.title, ...(m.duration !== undefined ? { duration: m.duration } : {}) } : {}),
    };
  };
  const at = today();
  for (const id of readLines(path.join(legacyDir, "all-ids.txt"))) upsertSource(state, { ...base(id), status: "discovered", at });
  const txtDir = path.join(legacyDir, "txt");
  if (fs.existsSync(txtDir)) {
    for (const name of fs.readdirSync(txtDir).filter((n) => n.endsWith(".txt"))) {
      if (fs.statSync(path.join(txtDir, name)).size > 0) upsertSource(state, { ...base(name.slice(0, -4)), status: "transcribed", at });
    }
  }
  const extracted = new Set(readLines(path.join(legacyDir, "done-extract-ids.txt")));
  for (const dir of fs.readdirSync(legacyDir).filter((d) => /^extract/.test(d))) {
    const full = path.join(legacyDir, dir);
    const files = fs.statSync(full).isDirectory() ? fs.readdirSync(full).map((f) => path.join(full, f)) : [full];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8")) as { videosRead?: string[] };
        for (const id of data.videosRead ?? []) extracted.add(id);
      } catch {
        /* archivo que no es una extracción */
      }
    }
  }
  for (const id of extracted) upsertSource(state, { ...base(id), status: "extracted", at });
  for (const id of readLines(path.join(legacyDir, "no-transcript-ids.txt"))) {
    upsertSource(state, { ...base(id), status: "skipped", reason: "sin transcripción automática", at });
  }
  const { catalog } = await loadAppCatalog(ctx);
  for (const b of catalog.books) {
    for (const s of b.sources ?? []) {
      const id = youtubeId(s.url);
      if (id) upsertSource(state, { ...base(id), status: "merged", at });
    }
  }
  Object.assign(state.asrHints, extra.asrHints ?? {});
  writeState(ctx, state);
  return state;
}
