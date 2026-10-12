import fs from "node:fs";
import path from "node:path";
import type { Context } from "./context";
import { readYamlFile, writeYamlFile } from "./lib/yaml-io";
import { WorkSchema, type Work } from "./schemas";

export function readRegistry(ctx: Context): Map<string, Work> {
  const out = new Map<string, Work>();
  if (!fs.existsSync(ctx.registryDir)) return out;
  for (const name of fs.readdirSync(ctx.registryDir).filter((n) => n.endsWith(".yaml")).sort()) {
    const work = readYamlFile(path.join(ctx.registryDir, name), WorkSchema);
    out.set(work.id, work);
  }
  return out;
}

export function writeWork(ctx: Context, work: Work) {
  writeYamlFile(path.join(ctx.registryDir, `${work.id}.yaml`), WorkSchema.parse(work));
}

/** Combina datos nuevos sin pisar lo que ya estaba verificado (solo completa huecos y suma ediciones). */
export function mergeWork(base: Work | undefined, add: Work): Work {
  if (!base) return add;
  const editions = [...(base.editions ?? [])];
  for (const e of add.editions ?? []) if (!editions.some((x) => x.isbn === e.isbn)) editions.push(e);
  return {
    ...add,
    ...base,
    openLibrary: { ...add.openLibrary, ...base.openLibrary },
    asin: { ...add.asin, ...base.asin },
    ...(editions.length ? { editions } : {}),
  };
}
