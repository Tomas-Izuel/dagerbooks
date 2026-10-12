/**
 * Contexto de un comando: raíz del repo, app del creador, carpeta de datos y config.
 * Los datos pesados (audio, transcripciones, cachés, extracciones) viven fuera de git en
 * PIPELINE_DATA_DIR (por defecto `<repo>/research/<creador>/`). Desde un worktree, apuntá
 * PIPELINE_DATA_DIR al clon principal: los worktrees no ven archivos sin trackear.
 */
import fs from "node:fs";
import path from "node:path";
import type { CatalogDef, CatalogOf } from "@estantes/catalog";
import { loadCatalogFrom } from "@estantes/catalog/node";

export interface CreatorInfo {
  id: string;
  name: string;
  site: { name: string };
  affiliate: { tag: string; marketplace: string } | null;
  modules: { progression: boolean; routes: boolean; updates: boolean };
  voice: { language: string; variant: string };
  channels: { kind: string; handle: string; url: string }[];
}

export function findRepoRoot(from = process.cwd()): string {
  let dir = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) throw new Error("no encontré la raíz del monorepo (pnpm-workspace.yaml)");
    dir = up;
  }
}

export interface Context {
  root: string;
  creator: string;
  appDir: string;
  contentDir: string;
  dataDir: string;
  pipelineDir: string;
  statePath: string;
  registryDir: string;
}

export function context(creator: string, opts: { root?: string; dataDir?: string } = {}): Context {
  const root = opts.root ?? findRepoRoot();
  const appDir = path.join(root, "apps", creator);
  if (!fs.existsSync(path.join(appDir, "creator.config.ts"))) throw new Error(`no existe apps/${creator}/creator.config.ts`);
  const pipelineDir = path.join(root, "packages", "pipeline");
  return {
    root,
    creator,
    appDir,
    contentDir: path.join(appDir, "content"),
    dataDir: opts.dataDir ?? process.env.PIPELINE_DATA_DIR ?? path.join(root, "research", creator),
    pipelineDir,
    statePath: path.join(pipelineDir, "state", `${creator}.yaml`),
    registryDir: path.join(pipelineDir, "registry", "works"),
  };
}

export async function loadCreator(ctx: Context): Promise<CreatorInfo> {
  return (await import(path.join(ctx.appDir, "creator.config.ts"))).default as CreatorInfo;
}

export async function loadCatalogDef(ctx: Context): Promise<CatalogDef> {
  return (await import(path.join(ctx.appDir, "catalog.ts"))).catalog as CatalogDef;
}

export async function loadAppCatalog(ctx: Context): Promise<{ def: CatalogDef; catalog: CatalogOf<CatalogDef> }> {
  const def = await loadCatalogDef(ctx);
  return { def, catalog: loadCatalogFrom(def, ctx.contentDir) };
}

/** Carpeta dentro de los datos del creador (la crea si hace falta). */
export function dataPath(ctx: Context, ...parts: string[]): string {
  const p = path.join(ctx.dataDir, ...parts);
  fs.mkdirSync(path.extname(p) ? path.dirname(p) : p, { recursive: true });
  return p;
}
