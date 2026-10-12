/**
 * Esqueleto de un sitio nuevo: apps/<slug> con config, modelo del catálogo, contenido vacío, scripts,
 * contexto para Claude y una página provisoria SIN diseño. La UI se escribe recién después de la
 * pasada de impeccable aprobada por el dueño (ver .claude/skills/new-creator).
 *
 *   pnpm new-creator <slug> --name "Nombre" --site "NombreDelSitio" [--language es] [--locale es_ES]
 *     [--modules progression,routes,updates] [--affiliate-tag tag --marketplace es] [--official]
 *     [--channel youtube:@handle] [--channel instagram:handle]…
 *
 * No pisa nada: si apps/<slug> existe, aborta.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true);
const opt = (name: string) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const all = (name: string) => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));

function fail(msg: string): never {
  console.error(`new-creator: ${msg}`);
  process.exit(1);
}

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail("uso: pnpm new-creator <slug-kebab> --name … --site …");
const name = opt("name") ?? fail("falta --name (cómo se lo nombra al creador)");
const site = opt("site") ?? fail("falta --site (nombre del sitio)");
const language = opt("language") ?? "es";
const locale = opt("locale") ?? (language === "es" ? "es_ES" : "en_US");
const modules = new Set((opt("modules") ?? "updates").split(",").filter(Boolean));
const tag = opt("affiliate-tag");
const marketplace = opt("marketplace") ?? "es";
const official = argv.includes("--official");
const CHANNEL_URL: Record<string, (h: string) => string> = {
  youtube: (h) => `https://www.youtube.com/${h.startsWith("@") ? h : `@${h}`}`,
  instagram: (h) => `https://www.instagram.com/${h.replace(/^@/, "")}/`,
  twitch: (h) => `https://www.twitch.tv/${h.replace(/^@/, "")}`,
  tiktok: (h) => `https://www.tiktok.com/${h.startsWith("@") ? h : `@${h}`}`,
};
const channels = all("channel").map((c) => {
  const [kind, handle] = c.split(":");
  if (!kind || !handle || !CHANNEL_URL[kind]) fail(`--channel "${c}": usá youtube|instagram|twitch|tiktok:<handle>`);
  return { kind, handle: handle.replace(/^@/, ""), url: CHANNEL_URL[kind](handle) };
});

const appDir = path.join(ROOT, "apps", slug);
if (fs.existsSync(appDir)) fail(`apps/${slug} ya existe`);
const dager = path.join(ROOT, "apps", "dagerbooks");
const pkgVersions = JSON.parse(fs.readFileSync(path.join(dager, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const v = (dep: string) => pkgVersions.dependencies[dep] ?? pkgVersions.devDependencies[dep];

const files: Record<string, string> = {};
const q = (s: string) => JSON.stringify(s);

files["package.json"] =
  JSON.stringify(
    {
      name: slug,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "pnpm validate && next build",
        start: "next start",
        lint: "eslint .",
        typecheck: "tsc --noEmit",
        validate: "tsx scripts/catalog.ts validate && tsx scripts/catalog.ts schema --check",
        schema: "tsx scripts/catalog.ts schema",
        test: "tsx --test scripts/*.test.ts",
      },
      dependencies: {
        "@estantes/catalog": "workspace:*",
        "@estantes/kit": "workspace:*",
        next: v("next"),
        react: v("react"),
        "react-dom": v("react-dom"),
      },
      devDependencies: Object.fromEntries(
        ["@types/node", "@types/react", "@types/react-dom", "eslint", "eslint-config-next", "tsx", "typescript"].map((d) => [d, v(d)]),
      ),
    },
    null,
    2,
  ) + "\n";

files["tsconfig.json"] = fs.readFileSync(path.join(dager, "tsconfig.json"), "utf8");
files["eslint.config.mjs"] = fs.readFileSync(path.join(dager, "eslint.config.mjs"), "utf8");
files["AGENTS.md"] = fs.readFileSync(path.join(dager, "AGENTS.md"), "utf8");
files[".env.example"] = fs.readFileSync(path.join(dager, ".env.example"), "utf8").replace(/dagerbooks\.com/g, `${slug}.com`);

files["next.config.ts"] = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los paquetes del monorepo se consumen como TypeScript fuente.
  transpilePackages: ["@estantes/catalog", "@estantes/kit"],
};

export default nextConfig;
`;

files["creator.config.ts"] = `/**
 * Todo lo propio de ${name} que no es UI. Los paquetes compartidos no conocen nada de esto.
 * Completá los TODO con el acuerdo del creador antes de publicar.
 */
import { defineCreator } from "@estantes/kit";

const config = defineCreator({
  id: ${q(slug)},
  name: ${q(name)},
  bio: ${q(`${name}`)}, // TODO: una frase de quién es y de qué habla
  site: {
    name: ${q(site)},
    description: ${q(`Los libros que recomienda ${name}, con la fuente de cada recomendación.`)}, // TODO: ajustar con la voz del sitio
    locale: ${q(locale)},
    defaultTitle: ${q(`${site} · Los libros que recomienda ${name}`)},
  },
  labels: {
    recommendation: {
      fuerte: { label: "Muy recomendado", description: "Insiste en que lo lean." }, // TODO: en la voz del sitio
      interesante: { label: "Recomendado", description: "Lo valora o lo recomienda con reservas." },
      mencion: { label: "Mencionado", description: "Lo cita o lo nombra, sin recomendarlo." },
      desaconseja: { label: "Desaconsejado", description: "Lo critica o dice que no lo lean." },
    },
    level: { 1: "Para empezar", 2: "Intermedio", 3: "Avanzado", 4: "Especialista" }, // TODO: etiquetas propias
    routeKind: { corriente: "Corriente", objetivo: "Objetivo" },
  },
  copy: {
    bookDescriptionFallback: (title, levelLabel) => \`\${title}: lectura \${levelLabel.toLowerCase()} que recomienda ${name.replace(/`/g, "")}.\`,
  },
  affiliate: ${tag ? `{ tag: ${q(tag)}, marketplace: ${q(marketplace)} }` : "null"}, // según el acuerdo
  brand: { official: ${official}, assets: "none" }, // "provided" solo si el acuerdo permite usar marca propia
  storageNamespace: ${q(slug)}, // no cambiar una vez publicado: es la clave del progreso de los lectores
  modules: { progression: ${modules.has("progression")}, routes: ${modules.has("routes")}, updates: ${modules.has("updates")} },
  voice: { language: ${q(language)}, variant: "TODO: registro y tono del sitio" },
  channels: ${JSON.stringify(channels, null, 2).replace(/\n/g, "\n  ")},
});

export default config;
`;

files["catalog.ts"] = `import { defineCatalog } from "@estantes/catalog";
import config from "./creator.config";

/** Modelo del catálogo de ${name}. */
export const catalog = defineCatalog({
  modules: config.modules,
  recommendations: ["fuerte", "interesante", "mencion", "desaconseja"],
  stance: "required",
  content: { books: { dir: "books" }, updates: { dir: "updates" } },
});
`;

files["scripts/catalog.ts"] = `/** \`pnpm validate\` y \`pnpm schema\`: la CLI del catálogo con el modelo de este sitio. */
import { runCli } from "@estantes/catalog/node";
import { catalog } from "../catalog";

process.exit(runCli(catalog));
`;

files["scripts/storage-keys.test.ts"] = `/** Las claves de localStorage guardan el estado de los lectores: fijalas acá cuando existan. */
import assert from "node:assert/strict";
import { it } from "node:test";
import config from "../creator.config";

it("el namespace de localStorage no cambia", () => {
  assert.equal(config.storageNamespace, ${q(slug)});
});
`;

files["content/topics.yaml"] = `# yaml-language-server: $schema=./topics.schema.json
# Temas del sitio: árbol de dos niveles (un tema puede tener \`parent\`). Los libros apuntan a hojas.
[]
`;
files["content/books/README.md"] = `# Libros

Un archivo por libro: \`content/books/<id>.yaml\` (el nombre del archivo es el \`id\`). Los escribe \`/add-books\`.
Formato: ver \`pnpm schema\` (book.schema.json) y \`.claude/skills/add-books/\`.
`;
files["content/books/.gitkeep"] = "";
if (modules.has("updates")) files["content/updates/.gitkeep"] = "";
if (modules.has("routes")) files["content/routes.yaml"] = "# yaml-language-server: $schema=./routes.schema.json\n[]\n";

// Página provisoria sin diseño: se reemplaza después de la Compuerta 2 de impeccable.
files["app/layout.tsx"] = `import type { Metadata } from "next";
import type { ReactNode } from "react";
import config from "@/creator.config";

export const metadata: Metadata = { title: config.site.defaultTitle, description: config.site.description };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang=${q(language)}>
      <body>{children}</body>
    </html>
  );
}
`;
files["app/page.tsx"] = `import config from "@/creator.config";

/** Provisoria: la vista principal la decide la pasada de diseño (/new-creator, Compuerta 2). */
export default function Home() {
  return (
    <main>
      <h1>{config.site.name}</h1>
      <p>{config.site.description}</p>
    </main>
  );
}
`;

files["PRODUCT.md"] = `# Product

<!-- Lo completa la pasada de impeccable (init) con el dueño. Solo identidad, audiencia y acuerdo de marca de ${name}. -->

## Platform

web

## Users

TODO

## Product Purpose

Los libros que recomienda ${name}, cada uno con la fuente donde lo recomienda.

## Brand Commitments

- Name: **${site}**.
- Acuerdo con ${name}: ${official ? "oficial" : "TODO: alcance del acuerdo"}; marca propia: ${"no (sin assets todavía)"}.
`;

files["CLAUDE.md"] = `@AGENTS.md

# ${slug}

Sitio de los libros que recomienda ${name}. Producto en \`PRODUCT.md\`, sistema visual en \`DESIGN.md\` (cuando exista),
estado de diseño en \`.impeccable/\`. Identidad, etiquetas, afiliado y canales en \`creator.config.ts\`; modelo en \`catalog.ts\`.

## Estado

Recién creado con \`pnpm new-creator\`. **No hay UI de diseño todavía**: la vista principal, la navegación y el mundo
visual salen de la pasada de impeccable de \`/new-creator\`, aprobada por el dueño. No copies nada de otra app.

## Comandos

- \`pnpm dev\`, \`pnpm build\`, \`pnpm validate\`, \`pnpm schema\`, \`pnpm test\`
- Libros: \`/add-books ${slug}\`
`;

for (const [rel, text] of Object.entries(files)) {
  const file = path.join(appDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
console.log(`new-creator: apps/${slug} creado (${Object.keys(files).length} archivos).`);
console.log(`Siguiente: pnpm install && pnpm --filter ${slug} schema && pnpm --filter ${slug} validate, y la pasada de impeccable (/new-creator).`);
