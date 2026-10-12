/**
 * Fronteras del monorepo (corre en `pnpm lint`):
 *   (a) packages/ no importa código de una app (`@/…`, `apps/…`)
 *   (b) una app no importa otra app
 *   (c) packages/ no nombra a ningún creador: nombres, ids, handles y dominios salen de cada
 *       apps/<x>/creator.config.ts (lista explícita, no heurística)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "research", ".work", "dist"]);
const CODE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const TEXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|json|md|yaml|yml|css)$/;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

const rel = (f: string) => path.relative(ROOT, f);
const importsOf = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
const problems: string[] = [];

const apps = fs.readdirSync(path.join(ROOT, "apps")).filter((d) => fs.existsSync(path.join(ROOT, "apps", d, "package.json")));

// (a) packages/ no importa apps
for (const file of walk(path.join(ROOT, "packages")).filter((f) => CODE.test(f))) {
  for (const spec of importsOf(fs.readFileSync(file, "utf8"))) {
    const resolved = spec.startsWith(".") ? path.resolve(path.dirname(file), spec) : "";
    if (spec.startsWith("@/") || /(^|\/)apps\//.test(spec) || resolved.startsWith(path.join(ROOT, "apps"))) {
      problems.push(`${rel(file)}: un paquete no puede importar código de una app ("${spec}")`);
    }
  }
}

// (b) una app no importa otra
for (const app of apps) {
  const appDir = path.join(ROOT, "apps", app);
  for (const file of walk(appDir).filter((f) => CODE.test(f))) {
    for (const spec of importsOf(fs.readFileSync(file, "utf8"))) {
      const resolved = spec.startsWith(".") ? path.resolve(path.dirname(file), spec) : "";
      const intoOtherApp = resolved && resolved.startsWith(path.join(ROOT, "apps")) && !resolved.startsWith(appDir + path.sep) && resolved !== appDir;
      if (intoOtherApp || /(^|\/)apps\//.test(spec)) problems.push(`${rel(file)}: una app no puede importar otra app ("${spec}")`);
    }
  }
}

// (c) packages/ no nombra creadores
async function creatorTerms(): Promise<{ app: string; term: string }[]> {
  const out: { app: string; term: string }[] = [];
  for (const app of apps) {
    const file = path.join(ROOT, "apps", app, "creator.config.ts");
    if (!fs.existsSync(file)) {
      problems.push(`apps/${app}: falta creator.config.ts`);
      continue;
    }
    let config: { id: string; name: string; site: { name: string }; channels: { handle: string; url: string }[] };
    try {
      config = (await import(file)).default;
    } catch (e) {
      problems.push(`apps/${app}/creator.config.ts: no se pudo cargar (${(e as Error).message.split("\n")[0]})`);
      continue;
    }
    const terms = [config.id, config.name, config.site.name, ...config.channels.map((c) => c.handle)];
    for (const c of config.channels) {
      try {
        const host = new URL(c.url).hostname.replace(/^www\./, "");
        // Dominios propios del creador; los de plataformas (youtube.com, reddit.com…) no identifican a nadie.
        if (!/(^|\.)(youtube|youtu|twitch|instagram|tiktok|reddit|github|spotify|apple)\.(com|be|tv)$/.test(host)) terms.push(host);
      } catch {
        /* url inválida: la valida otro lado */
      }
    }
    for (const term of new Set(terms.filter((t) => t && t.length >= 3))) out.push({ app, term });
  }
  return out;
}

async function main() {
  const terms = await creatorTerms();
  for (const file of walk(path.join(ROOT, "packages")).filter((f) => TEXT.test(f))) {
    const text = fs.readFileSync(file, "utf8").toLowerCase();
    for (const { app, term } of terms) {
      if (text.includes(term.toLowerCase())) problems.push(`${rel(file)}: nombra a un creador ("${term}", de apps/${app})`);
    }
  }

  if (problems.length) {
    console.error(`Fronteras del monorepo: ${problems.length} problema${problems.length === 1 ? "" : "s"}\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`Fronteras OK: ${apps.length} app(s), ${terms.length} términos de creadores fuera de packages/.`);
}

void main();
