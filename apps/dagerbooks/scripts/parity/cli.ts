/**
 * Harness de paridad: compara dos builds de la app para probar que un refactor no cambia el producto.
 *
 *   pnpm parity snapshot --out <dir> [--next .next] [--content content]
 *   pnpm parity diff <base> <head> [--ignore <glob>]...
 *   pnpm parity golden [--record]
 *
 * Los snapshots van al SSD (por ejemplo research/parity/, que está en .gitignore), nunca a /tmp.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadCatalogFrom } from "../../lib/catalog/load";
import { runGolden } from "./golden";
import { canonicalJson, isText, normalizeText } from "./normalize";

function arg(args: string[], name: string, fallback?: string): string {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`falta ${name}`);
}

function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });
}

const sha = (buf: Buffer | string) => crypto.createHash("sha256").update(buf).digest("hex");

function snapshot(args: string[]) {
  const nextDir = path.resolve(arg(args, "--next", ".next"));
  const contentDir = path.resolve(arg(args, "--content", "content"));
  const out = path.resolve(arg(args, "--out"));
  const appDir = path.join(nextDir, "server", "app");
  if (!fs.existsSync(appDir)) throw new Error(`no existe ${appDir}: corré pnpm build antes`);
  const buildId = fs.readFileSync(path.join(nextDir, "BUILD_ID"), "utf8").trim();

  fs.rmSync(out, { recursive: true, force: true });
  const files = walk(appDir).filter((f) => /\.(html|rsc|meta|body)$/.test(f));
  const hashes: Record<string, string> = {};
  for (const rel of files.sort()) {
    const raw = fs.readFileSync(path.join(appDir, rel));
    if (isText(rel)) {
      const dest = path.join(out, "app", rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, normalizeText(raw.toString("utf8"), buildId));
    } else {
      hashes[rel] = sha(raw);
      // Se guarda la imagen para poder mirarla si el hash cambia.
      const dest = path.join(out, "bin", rel.replace(/\.body$/, ".png"));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, raw);
    }
  }
  fs.writeFileSync(path.join(out, "binary-hashes.json"), canonicalJson(hashes));

  const catalog = loadCatalogFrom(contentDir);
  fs.writeFileSync(path.join(out, "catalog.json"), canonicalJson(catalog));
  console.log(`snapshot: ${files.length} archivos (${Object.keys(hashes).length} binarios) + catalog.json → ${out}`);
}

/** Glob mínimo: `*` dentro de un segmento, `**` cualquier cantidad de segmentos. */
const globRe = (glob: string) =>
  new RegExp(
    "^" +
      glob
        .split("**")
        .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
        .join(".*") +
      "$",
  );

function firstDifference(a: string, b: string): string {
  const la = a.split("\n");
  const lb = b.split("\n");
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    if (la[i] === lb[i]) continue;
    const x = la[i] ?? "";
    const y = lb[i] ?? "";
    let c = 0;
    while (c < x.length && x[c] === y[c]) c++;
    const from = Math.max(0, c - 80);
    return `línea ${i + 1}, col ${c + 1}\n      base: …${x.slice(from, c + 160)}\n      head: …${y.slice(from, c + 160)}`;
  }
  return "(sin diferencias de línea)";
}

function diff(args: string[]) {
  const [base, head] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!base || !head) throw new Error("uso: parity diff <base> <head> [--ignore <glob>]");
  const ignores = args.flatMap((a, i) => (args[i - 1] === "--ignore" ? [globRe(a)] : []));
  const ignored = (f: string) => ignores.some((re) => re.test(f));

  const listing = (dir: string) => new Set(walk(dir).filter((f) => !ignored(f) && !f.startsWith("bin/")));
  const a = listing(base);
  const b = listing(head);
  const problems: string[] = [];
  for (const f of a) if (!b.has(f)) problems.push(`- falta en head: ${f}`);
  for (const f of b) if (!a.has(f)) problems.push(`+ nuevo en head: ${f}`);
  // Las imágenes OG bajan fuentes y tapas por red: si fallan, cambian sin que cambie el código.
  // Se informan aparte y no hacen fallar la paridad; revisalas en bin/ de cada snapshot.
  const binaryFile = "binary-hashes.json";
  if (a.has(binaryFile) && b.has(binaryFile)) {
    a.delete(binaryFile);
    const x = JSON.parse(fs.readFileSync(path.join(base, binaryFile), "utf8")) as Record<string, string>;
    const y = JSON.parse(fs.readFileSync(path.join(head, binaryFile), "utf8")) as Record<string, string>;
    for (const k of Object.keys(x)) if (!(k in y)) problems.push(`- falta en head: ${k}`);
    for (const k of Object.keys(y)) if (!(k in x)) problems.push(`+ nuevo en head: ${k}`);
    const changed = Object.keys(x).filter((k) => k in y && x[k] !== y[k] && !ignored(k));
    if (changed.length) {
      console.warn(`aviso: ${changed.length} imagen(es) OG distintas (puede ser la red); revisalas a mano:`);
      for (const k of changed) console.warn(`    ${k}`);
    }
  }
  for (const f of [...a].filter((f) => b.has(f) && f !== binaryFile).sort()) {
    // Se vuelve a normalizar: así un snapshot viejo sirve aunque la normalización haya mejorado.
    const x = normalizeText(fs.readFileSync(path.join(base, f), "utf8"), "");
    const y = normalizeText(fs.readFileSync(path.join(head, f), "utf8"), "");
    if (x !== y) problems.push(`~ distinto: ${f}\n    ${firstDifference(x, y)}`);
  }
  if (problems.length) {
    console.error(`paridad: ${problems.length} diferencia${problems.length === 1 ? "" : "s"}\n`);
    console.error(problems.slice(0, 12).join("\n"));
    if (problems.length > 12) console.error(`\n… y ${problems.length - 12} más`);
    process.exit(1);
  }
  console.log(`paridad: idéntico (${a.size} archivos)`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "snapshot") snapshot(rest);
  else if (cmd === "diff") diff(rest);
  else if (cmd === "golden") process.exit(runGolden(rest.includes("--record")) ? 0 : 1);
  else {
    console.error("uso: parity snapshot|diff|golden (ver scripts/parity/cli.ts)");
    process.exit(2);
  }
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
