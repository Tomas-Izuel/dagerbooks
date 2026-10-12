/** Novedades: detectar sitios afectados por un diff y crear o extender la entrada de un sitio. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { UPDATE_LIMITS } from "@estantes/catalog";
import { loadCatalogFrom } from "@estantes/catalog/node";
import { findRepoRoot, loadCatalogDef, type Context } from "../context";
import { affectedApps, type AppCapabilities } from "../affected";
import { today } from "../lib/text";

const git = (root: string, args: string[]) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.split("\n").filter(Boolean);
};

async function appCapabilities(root: string): Promise<AppCapabilities[]> {
  const out: AppCapabilities[] = [];
  for (const id of fs.readdirSync(path.join(root, "apps"))) {
    const dir = path.join(root, "apps", id);
    if (!fs.existsSync(path.join(dir, "creator.config.ts"))) continue;
    const config = (await import(path.join(dir, "creator.config.ts"))).default as { modules: AppCapabilities["modules"]; affiliate: unknown };
    const usesSuggestions = spawnSync("git", ["grep", "-l", "createSuggestion", "--", `apps/${id}`], { cwd: root, encoding: "utf8" }).stdout.trim() !== "";
    out.push({ id, modules: config.modules, affiliate: config.affiliate !== null, suggestions: usesSuggestions });
  }
  return out;
}

/** Archivos cambiados respecto de `base` (commits, cambios sin commitear y archivos nuevos). */
export function changedFiles(root: string, base: string): string[] {
  const mergeBase = git(root, ["merge-base", base, "HEAD"])[0];
  return [...new Set([...git(root, ["diff", "--name-only", mergeBase]), ...git(root, ["ls-files", "--others", "--exclude-standard"])])].sort();
}

export async function affectedCommand(base: string) {
  const root = findRepoRoot();
  const files = changedFiles(root, base);
  const result = affectedApps(files, await appCapabilities(root));
  console.log(JSON.stringify(result, null, 2));
}

export interface UpdateEntryInput {
  slug: string;
  date?: string;
  title: string;
  stream?: { title: string; url: string };
  books?: string[];
  improvements: string[];
}

const q = (s: string) => JSON.stringify(s);

export function updateYaml(e: Required<Pick<UpdateEntryInput, "title" | "improvements">> & { id: string; date: string; stream?: UpdateEntryInput["stream"]; books?: string[] }): string {
  const lines = ["# yaml-language-server: $schema=../update.schema.json", "", `id: ${e.id}`, `date: ${e.date}`, `title: ${q(e.title)}`];
  if (e.stream) lines.push("stream:", `  title: ${q(e.stream.title)}`, `  url: ${q(e.stream.url)}`);
  if (e.books?.length) lines.push("books:", ...e.books.map((b) => `  - ${b}`));
  lines.push("improvements:", ...e.improvements.map((i) => `  - ${q(i)}`));
  return lines.join("\n") + "\n";
}

/**
 * Crea `content/updates/<fecha>-<slug>.yaml` o extiende la de la misma fecha: une libros sin repetir,
 * conserva el stream solo si es el mismo y suma mejoras nuevas. Si quedarían más de 5 mejoras, falla
 * para que la skill condense (o con `split` crea `<fecha>-<slug>-2`).
 */
export async function upsertUpdate(ctx: Context, input: UpdateEntryInput, opts: { split?: boolean } = {}) {
  const date = input.date ?? today();
  const dir = path.join(ctx.contentDir, "updates");
  const problems: string[] = [];
  if (input.title.length > UPDATE_LIMITS.title) problems.push(`title: hasta ${UPDATE_LIMITS.title} caracteres`);
  if (input.stream && input.stream.title.length > UPDATE_LIMITS.streamTitle) problems.push(`stream.title: hasta ${UPDATE_LIMITS.streamTitle} caracteres`);
  input.improvements.forEach((m, i) => m.length > UPDATE_LIMITS.improvement && problems.push(`improvements[${i}]: hasta ${UPDATE_LIMITS.improvement} caracteres`));
  if (problems.length) throw new Error(`novedad inválida:\n  - ${problems.join("\n  - ")}`);

  let id = `${date}-${input.slug}`;
  let file = path.join(dir, `${id}.yaml`);
  let entry = { id, date, title: input.title, stream: input.stream, books: input.books ?? [], improvements: [...input.improvements] };
  if (fs.existsSync(file)) {
    const { parse } = await import("yaml");
    const cur = parse(fs.readFileSync(file, "utf8")) as typeof entry;
    const merged = {
      ...cur,
      stream: cur.stream && input.stream && cur.stream.url === input.stream.url ? cur.stream : cur.stream && !input.stream ? cur.stream : undefined,
      books: [...new Set([...(cur.books ?? []), ...(input.books ?? [])])],
      improvements: [...new Set([...cur.improvements, ...input.improvements])],
    };
    if (merged.improvements.length > UPDATE_LIMITS.improvements) {
      if (!opts.split) throw new Error(`${id}: quedarían ${merged.improvements.length} mejoras (máximo ${UPDATE_LIMITS.improvements}); condensalas o usá --split`);
      let n = 2;
      while (fs.existsSync(path.join(dir, `${date}-${input.slug}-${n}.yaml`))) n++;
      id = `${date}-${input.slug}-${n}`;
      file = path.join(dir, `${id}.yaml`);
      entry = { ...entry, id };
    } else entry = merged;
  }
  if (entry.improvements.length < 1 || entry.improvements.length > UPDATE_LIMITS.improvements) throw new Error(`improvements: entre 1 y ${UPDATE_LIMITS.improvements}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, updateYaml(entry));
  try {
    loadCatalogFrom(await loadCatalogDef(ctx), ctx.contentDir);
  } catch (e) {
    throw new Error(`${path.relative(ctx.root, file)} no valida:\n${(e as Error).message}`);
  }
  console.log(`update-entry: ${path.relative(ctx.root, file)}`);
}
