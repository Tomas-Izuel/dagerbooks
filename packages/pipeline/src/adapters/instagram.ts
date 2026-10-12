/**
 * Export oficial de Instagram ("Descargar tu información", formato JSON). El formato cambia con el
 * tiempo, así que en vez de depender de una ruta fija se recorren todos los JSON buscando medios:
 * objetos con `uri` a un .mp4 y `creation_timestamp`. El caption viene en `title` (del medio o del
 * post que lo contiene). Meta suele exportar texto con mojibake (UTF-8 leído como latin1): se repara.
 *
 * El export no siempre trae el link público del reel; sin él la cita queda sin URL. Verificá con un
 * export real antes de confiar en este adaptador.
 */
import fs from "node:fs";
import path from "node:path";

export interface ExportedReel {
  /** Nombre del archivo sin extensión (estable dentro del export). */
  id: string;
  file: string;
  date: string;
  caption?: string;
  /** Link público si el export lo trae. */
  url?: string;
}

/** "Ã¡" → "á": texto UTF-8 que Meta escapó como si fuera latin1. */
export function fixMojibake(s: string): string {
  if (!/[À-ÿ][\u0080-¿]/.test(s)) return s;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    return fixed.includes("�") ? s : fixed;
  } catch {
    return s;
  }
}

function walkJson(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walkJson(full) : e.name.endsWith(".json") ? [full] : [];
  });
}

export function parseInstagramExport(root: string): ExportedReel[] {
  const found = new Map<string, ExportedReel>();
  const visit = (node: unknown, parentTitle?: string) => {
    if (Array.isArray(node)) return node.forEach((n) => visit(n, parentTitle));
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const title = typeof o.title === "string" && o.title ? fixMojibake(o.title) : parentTitle;
    if (typeof o.uri === "string" && /\.mp4$/i.test(o.uri) && typeof o.creation_timestamp === "number") {
      const id = path.basename(o.uri, path.extname(o.uri));
      const permalink = [o.permalink, o.href, o.url].find((v) => typeof v === "string" && /instagram\.com\//.test(v)) as string | undefined;
      found.set(id, {
        id,
        file: path.join(root, o.uri),
        date: new Date(o.creation_timestamp * 1000).toISOString().slice(0, 10),
        ...(title ? { caption: title } : {}),
        ...(permalink ? { url: permalink } : {}),
      });
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v, title);
  };
  for (const file of walkJson(root)) {
    try {
      visit(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch {
      /* JSON que no es del export */
    }
  }
  return [...found.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
