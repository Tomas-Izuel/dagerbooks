/** Ingesta: descubrir fuentes, conseguir su texto (subtítulos o Whisper) y armar tandas para extraer. */
import fs from "node:fs";
import path from "node:path";
import { dataPath, loadCreator, type Context } from "../context";
import { downloadAudio, downloadSubs, listChannel } from "../adapters/youtube";
import { parseInstagramExport } from "../adapters/instagram";
import { transcribe } from "../adapters/whisper";
import { bestVtt, vttToText } from "../lib/vtt";
import { readState, upsertSource, writeState } from "../state";
import type { SourceStatus, StateSource } from "../schemas";

const txtPath = (ctx: Context, s: Pick<StateSource, "platform" | "id">) =>
  dataPath(ctx, "txt", s.platform === "youtube" ? `${s.id}.txt` : `${s.platform}-${s.id}.txt`);

const hasText = (file: string) => fs.existsSync(file) && fs.statSync(file).size > 0;

/** Lista los canales de YouTube de la config (o un export de Instagram) y suma lo nuevo como `discovered`. */
export async function discover(ctx: Context, opts: { fromExport?: string } = {}) {
  const state = readState(ctx);
  let added = 0;
  if (opts.fromExport) {
    // Índice id → mp4 del export, para transcribir después.
    const indexFile = dataPath(ctx, "exports", "instagram-media.tsv");
    const index = new Map(
      fs.existsSync(indexFile) ? fs.readFileSync(indexFile, "utf8").split("\n").filter(Boolean).map((l) => l.split("\t") as [string, string]) : [],
    );
    for (const reel of parseInstagramExport(opts.fromExport)) {
      const isNew = upsertSource(state, {
        id: reel.id,
        platform: "instagram",
        status: "discovered",
        ...(reel.caption ? { title: reel.caption.slice(0, 200) } : {}),
        ...(reel.url ? { url: reel.url } : { reason: "el export no trae el link público del reel" }),
        at: reel.date,
      });
      if (isNew) added++;
      index.set(reel.id, reel.file);
    }
    fs.writeFileSync(indexFile, [...index].map(([id, file]) => `${id}\t${file}`).join("\n") + "\n");
  } else {
    const creator = await loadCreator(ctx);
    for (const ch of creator.channels.filter((c) => c.kind === "youtube")) {
      for (const { tab, videos } of listChannel(ch.url)) {
        for (const v of videos) {
          const url = tab === "shorts" ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`;
          if (upsertSource(state, { id: v.id, platform: "youtube", channel: ch.handle, title: v.title, url, status: "discovered", ...(v.duration !== undefined ? { duration: v.duration } : {}) }))
            added++;
        }
        console.log(`  ${ch.handle}/${tab}: ${videos.length}`);
      }
    }
  }
  writeState(ctx, state);
  console.log(`discover: ${added} fuente(s) nueva(s)`);
}

/** Subtítulos automáticos de YouTube para lo descubierto sin texto. Marca `transcribed` lo que consigue. */
export async function fetchSubs(ctx: Context, opts: { limit?: number } = {}) {
  const creator = await loadCreator(ctx);
  const state = readState(ctx);
  const subsDir = dataPath(ctx, "subs");
  const todo = state.sources
    .filter((s) => s.platform === "youtube" && s.status === "discovered" && !hasText(txtPath(ctx, s)))
    .slice(0, opts.limit ?? Infinity);
  downloadSubs(todo.map((s) => s.id), creator.voice.language, subsDir);
  const vtts = fs.readdirSync(subsDir).filter((f) => f.endsWith(".vtt"));
  let ok = 0;
  for (const s of todo) {
    const best = bestVtt(vtts.filter((f) => f.startsWith(`${s.id}.`)), creator.voice.language);
    if (!best) continue;
    const text = vttToText(fs.readFileSync(path.join(subsDir, best), "utf8"));
    if (!text) continue;
    fs.writeFileSync(txtPath(ctx, s), text);
    upsertSource(state, { ...s, status: "transcribed" });
    ok++;
  }
  writeState(ctx, state);
  console.log(`fetch-subs: ${ok}/${todo.length} con subtítulos; el resto va por \`transcribe\``);
}

/** Whisper para fuentes sin texto (videos sin subtítulos, streams, reels del export). */
export async function transcribeSources(ctx: Context, opts: { ids?: string[]; limit?: number } = {}) {
  const creator = await loadCreator(ctx);
  const state = readState(ctx);
  const media = new Map<string, string>();
  const mediaIndex = path.join(ctx.dataDir, "exports", "instagram-media.tsv");
  if (fs.existsSync(mediaIndex)) {
    for (const line of fs.readFileSync(mediaIndex, "utf8").split("\n").filter(Boolean)) {
      const [id, file] = line.split("\t");
      media.set(id, file);
    }
  }
  const todo = state.sources
    .filter((s) => (opts.ids ? opts.ids.includes(s.id) : s.status === "discovered") && !hasText(txtPath(ctx, s)))
    .slice(0, opts.limit ?? Infinity);
  for (const s of todo) {
    let audio = media.get(s.id);
    if (!audio) {
      if (!s.url) {
        console.warn(`  ${s.id}: sin url ni archivo; se saltea`);
        continue;
      }
      audio = dataPath(ctx, "audio", `${s.platform}-${s.id}.m4a`);
      if (!fs.existsSync(audio)) downloadAudio(s.url, audio);
    }
    const text = transcribe(audio, creator.voice.language, dataPath(ctx, "whisper"), dataPath(ctx, "hf"));
    fs.writeFileSync(txtPath(ctx, s), text);
    upsertSource(state, { ...s, status: "transcribed" });
    writeState(ctx, state);
    console.log(`  ${s.platform}/${s.id}: ${text.split("\n").length} líneas`);
  }
  console.log(`transcribe: ${todo.length} fuente(s)`);
}

/** Reparte lo transcripto sin extraer en tandas de hasta `cap` bytes de texto (un agente por tanda). */
export function makeBatches(
  sources: readonly StateSource[],
  sizeOf: (s: StateSource) => number,
  assigned: ReadonlySet<string>,
  cap: number,
): StateSource[][] {
  const out: StateSource[][] = [];
  let cur: StateSource[] = [];
  let size = 0;
  for (const s of sources) {
    if (assigned.has(s.id)) continue;
    const n = sizeOf(s);
    if (!n) continue;
    if (size + n > cap && cur.length) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(s);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function batch(ctx: Context, opts: { cap?: number } = {}) {
  const state = readState(ctx);
  const dir = dataPath(ctx, "batches");
  const existing = fs.readdirSync(dir).filter((f) => /^b\d+\.tsv$/.test(f));
  const assigned = new Set(existing.flatMap((f) => fs.readFileSync(path.join(dir, f), "utf8").split("\n").map((l) => l.split("\t")[0])));
  const transcribed = state.sources.filter((s) => s.status === "transcribed").sort((a, b) => a.id.localeCompare(b.id));
  const batches = makeBatches(transcribed, (s) => (hasText(txtPath(ctx, s)) ? fs.statSync(txtPath(ctx, s)).size : 0), assigned, opts.cap ?? 600_000);
  let n = existing.length;
  for (const b of batches) {
    n++;
    const name = `b${String(n).padStart(2, "0")}.tsv`;
    const rows = b.map((s) => [s.id, s.platform, s.channel ?? "?", s.duration ?? "?", s.title ?? "?", path.relative(ctx.dataDir, txtPath(ctx, s))].join("\t"));
    fs.writeFileSync(path.join(dir, name), rows.join("\n") + "\n");
    console.log(`  ${name}: ${b.length} fuente(s)`);
  }
  console.log(`batch: ${batches.length} tanda(s) nueva(s) en ${path.relative(ctx.root, dir) || dir}`);
}

/** Parte una transcripción larga en partN.txt de hasta `maxChars` (por líneas), para un agente por parte. */
export function split(ctx: Context, id: string, maxChars = 120_000) {
  const state = readState(ctx);
  const s = state.sources.find((x) => x.id === id);
  if (!s) throw new Error(`no hay una fuente "${id}" en el estado`);
  const text = fs.readFileSync(txtPath(ctx, s), "utf8").split("\n");
  const dir = dataPath(ctx, "parts", id);
  let part = 0;
  let cur: string[] = [];
  let size = 0;
  const flush = () => {
    if (!cur.length) return;
    fs.writeFileSync(path.join(dir, `part${part++}.txt`), cur.join("\n") + "\n");
    cur = [];
    size = 0;
  };
  for (const line of text) {
    if (size + line.length > maxChars) flush();
    cur.push(line);
    size += line.length + 1;
  }
  flush();
  console.log(`split: ${part} parte(s) en ${dir}`);
}

/** Cambia el estado de fuentes a mano (lo usa /add-books después de extraer o incorporar). */
export function mark(ctx: Context, ids: string[], status: SourceStatus, reason?: string) {
  const state = readState(ctx);
  let n = 0;
  for (const id of ids) {
    const s = state.sources.find((x) => x.id === id);
    if (!s) {
      console.warn(`  ${id}: no está en el estado`);
      continue;
    }
    upsertSource(state, { ...s, status, ...(reason ? { reason } : {}) }, true);
    n++;
  }
  writeState(ctx, state);
  console.log(`mark: ${n} fuente(s) → ${status}`);
}
