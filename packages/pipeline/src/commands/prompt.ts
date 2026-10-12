/**
 * Rellena una plantilla de .claude/skills/add-books/prompts/ con los datos del creador, su catálogo
 * y su estado. Falla si queda alguna {{variable}} sin valor: un prompt a medias produce basura.
 */
import fs from "node:fs";
import path from "node:path";
import { dataPath, loadAppCatalog, loadCreator, type Context } from "../context";
import { readState } from "../state";
import { knownBooks } from "./basics";

const LANGUAGES: Record<string, string> = { es: "español", en: "inglés", pt: "portugués" };

export const STANCE_DEFINITIONS = [
  "- `recommends`: lo recomienda o lo elogia como lectura.",
  "- `mixed`: lo recomienda con reservas fuertes.",
  "- `mentions`: lo nombra o lo cita sin recomendarlo.",
  "- `criticizes`: dice que es malo o que no lo leas.",
].join("\n");

const DEFAULT_STANDARD =
  "Cada libro se tiene que poder defender con una cita: no inventes lo que el creador no dijo; las citas son textuales y llevan el minuto exacto.";

/** Reemplaza {{clave}}; devuelve el texto y las claves que faltaron. */
export function render(template: string, vars: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = template.replace(/\{\{([\w.]+)\}\}/g, (all, key: string) => {
    if (key in vars) return vars[key];
    missing.add(key);
    return all;
  });
  return { text, missing: [...missing] };
}

export async function promptVars(ctx: Context, opts: { source?: string; batch?: string } = {}): Promise<Record<string, string>> {
  const creator = (await loadCreator(ctx)) as Awaited<ReturnType<typeof loadCreator>> & {
    bio?: string;
    standard?: string;
    labels: { level: Record<number, string>; recommendation: Record<string, { label: string; description: string }> };
  };
  const { def, catalog } = await loadAppCatalog(ctx);
  const state = readState(ctx);
  const known = dataPath(ctx, "known-books.tsv");
  fs.writeFileSync(known, `id\tnivel\ttema\ttítulo\tautores\n${await knownBooks(ctx)}\n`);

  const children = new Map<string, string[]>();
  for (const t of catalog.topics) if (t.parent) children.set(t.parent, [...(children.get(t.parent) ?? []), t.id]);
  const taxonomy = catalog.topics
    .filter((t) => !t.parent)
    .flatMap((t) => {
      const kids = catalog.topics.filter((c) => c.parent === t.id);
      return kids.length
        ? [`- ${t.name} (no se usa directo):`, ...kids.map((c) => `  - \`${c.id}\` ${c.name}: ${c.description}`)]
        : [`- \`${t.id}\` ${t.name}: ${t.description}`];
    })
    .join("\n");
  const levels = Object.entries(creator.labels.level)
    .filter(([n]) => def.modules.progression || Number(n) > 0)
    .map(([n, l]) => `${n} ${l}`)
    .join(" · ");
  const hints = Object.entries(state.asrHints);

  const vars: Record<string, string> = {
    "creator.name": creator.name,
    "creator.bio": creator.bio ?? creator.name,
    "site.name": creator.site.name,
    language: LANGUAGES[creator.voice.language] ?? creator.voice.language,
    voice: creator.voice.variant,
    channels: creator.channels.map((c) => `${c.handle} (${c.kind})`).join(", "),
    levelLabels: levels,
    taxonomy,
    recommendations: def.recommendations.map((r) => `\`${r}\``).join(", "),
    recommendationLabels: def.recommendations
      .map((r) => `  - \`${r}\`: ${creator.labels.recommendation[r]?.description ?? r}`)
      .join("\n"),
    stanceDefinitions: STANCE_DEFINITIONS,
    standard: creator.standard ?? DEFAULT_STANDARD,
    asrHints: hints.length ? hints.map(([k, v]) => `- "${k}" → ${v}`).join("\n") : "- (ninguna registrada todavía)",
    dataDir: ctx.dataDir,
    contentDir: path.relative(ctx.root, ctx.contentDir),
    knownBooks: known,
    modules: Object.entries(def.modules).filter(([, on]) => on).map(([m]) => m).join(", ") || "ninguno",
  };
  if (opts.source) {
    const s = state.sources.find((x) => x.id === opts.source);
    if (!s) throw new Error(`no hay una fuente "${opts.source}" en el estado`);
    Object.assign(vars, {
      "video.id": s.id,
      "video.title": s.title ?? s.id,
      "video.url": s.url ?? "",
      "video.ignoreWindows": s.ignoreWindows?.length ? s.ignoreWindows.join(", ") : "ninguno",
    });
  }
  if (opts.batch) Object.assign(vars, { batch: opts.batch, batchName: path.basename(opts.batch, path.extname(opts.batch)) });
  return vars;
}

export async function promptCommand(ctx: Context, name: string, opts: { source?: string; batch?: string; set: string[]; out?: string }) {
  const file = path.join(ctx.root, ".claude", "skills", "add-books", "prompts", `${name}.md`);
  if (!fs.existsSync(file)) throw new Error(`no existe la plantilla ${path.relative(ctx.root, file)}`);
  const vars = await promptVars(ctx, opts);
  for (const kv of opts.set) {
    const i = kv.indexOf("=");
    if (i < 1) throw new Error(`--set espera clave=valor (recibí "${kv}")`);
    vars[kv.slice(0, i)] = kv.slice(i + 1);
  }
  const { text, missing } = render(fs.readFileSync(file, "utf8"), vars);
  if (missing.length) throw new Error(`faltan variables: ${missing.join(", ")} (pasalas con --set clave=valor)`);
  if (opts.out) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, text);
    console.log(`prompt: ${name} → ${opts.out}`);
  } else console.log(text);
}
