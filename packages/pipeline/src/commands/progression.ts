/**
 * Módulos `progression` y `routes`: aplicar planes de línea (leadsTo, tramos a pie, niveles), la
 * calibración de tramos a pie y armar routes.yaml desde las rutas escritas por los agentes.
 * Ports de research/roadmaps/merge_roadmaps.py, apply_calibration.py y research/rutas/to_yaml.py,
 * ahora sobre un archivo por libro.
 */
import fs from "node:fs";
import path from "node:path";
import { isMap, isScalar, isSeq, type Document, type YAMLMap, type YAMLSeq } from "yaml";
import { loadCatalogFrom } from "@estantes/catalog/node";
import { loadAppCatalog, loadCatalogDef, loadCreator, type Context } from "../context";
import { bookFile, readBookDoc, setField, writeDoc } from "../lib/books-io";
import { readJson } from "../lib/yaml-io";
import { CalibrationSchema, RoadmapSchema, RouteProposalSchema, WrittenRouteFileSchema, type PlannedEdge, type Roadmap, type WrittenRoute } from "../schemas";

type LeadsTo = (string | { id: string; gap: { severity: string; bridge: string[]; note?: string } })[];

/** Lista de leadsTo: ids sueltos en línea, o con objetos si alguna arista lleva tramo a pie. */
function leadsToValue(edges: readonly PlannedEdge[]): LeadsTo {
  return edges.map((e) =>
    e.gap === "fuerte" || e.gap === "muy-fuerte"
      ? { id: e.id, gap: { severity: e.gap, bridge: (e.bridge ?? []).slice(0, 5), ...(e.note ? { note: e.note } : {}) } }
      : e.id,
  );
}

export interface RoadmapPlan {
  /** origen → aristas finales (sin las que no crecen de nivel). */
  edges: Map<string, PlannedEdge[]>;
  levels: Map<string, number>;
  report: string[];
  errors: string[];
}

/**
 * Combina los planes de cada línea. La línea dueña de un libro decide su leadsTo; los trasbordos
 * que proponen otras líneas se suman salvo que la dueña los haya descartado. Cada cambio de nivel
 * se aplica una sola vez (el script original los volvía a sumar por cada trasbordo entrante).
 */
export function planRoadmaps(docs: readonly Roadmap[], levels: ReadonlyMap<string, number>): RoadmapPlan {
  const ids = new Set(levels.keys());
  const plans = new Map<string, Map<string, PlannedEdge>>();
  const dropped = new Set<string>();
  const report: string[] = [];
  const errors: string[] = [];
  const nextLevels = new Map(levels);
  const incoming: (PlannedEdge & { from: string })[] = [];

  for (const d of docs) {
    report.push(`${d.topic}: ${d.verdict}`);
    const entries = Array.isArray(d.leadsTo) ? d.leadsTo : Object.entries(d.leadsTo);
    for (const [src, edges] of entries) {
      if (!ids.has(src)) {
        report.push(`  ! ${src} no existe`);
        continue;
      }
      const map = plans.get(src) ?? new Map<string, PlannedEdge>();
      for (const e of edges) map.set(e.id, e);
      plans.set(src, map);
    }
    for (const r of d.edgeReview) if (r.keep === false) dropped.add(`${r.from}->${r.to}`);
    for (const e of d.incomingFromOtherLines) incoming.push({ ...e, id: e.to });
    for (const c of d.levelChanges) {
      if (!nextLevels.has(c.id)) continue;
      report.push(`  nivel ${c.id}: ${nextLevels.get(c.id)} -> ${c.to} (${d.topic})`);
      nextLevels.set(c.id, c.to);
    }
  }
  for (const e of incoming) {
    if (dropped.has(`${e.from}->${e.id}`)) {
      report.push(`  ~ trasbordo ${e.from}->${e.id} descartado por la línea dueña`);
      continue;
    }
    const map = plans.get(e.from) ?? new Map<string, PlannedEdge>();
    if (!map.has(e.id)) map.set(e.id, e);
    plans.set(e.from, map);
  }

  const edges = new Map<string, PlannedEdge[]>();
  for (const [src, map] of plans) {
    const list: PlannedEdge[] = [];
    for (const e of map.values()) {
      const lt = nextLevels.get(e.id);
      const ls = nextLevels.get(src)!;
      if (lt === undefined) errors.push(`${src}->${e.id}: destino inexistente`);
      else if (lt <= ls) errors.push(`${src}(L${ls})->${e.id}(L${lt}): nivel no crece`);
      else list.push(e);
    }
    edges.set(src, list);
  }
  return { edges, levels: nextLevels, report, errors };
}

const leadsToNode = (doc: Document, value: LeadsTo) => {
  setField(doc, "leadsTo", value);
  // Con tramos a pie, la lista va en bloque (cada arista en su renglón).
  const node = (doc.contents as YAMLMap).get("leadsTo", true) as unknown as YAMLSeq;
  if (value.some((v) => typeof v !== "string")) {
    // Estilo de los archivos existentes: ids y severidad sin comillas, bridge en línea con comillas.
    node.flow = false;
    for (const item of node.items) {
      if (isScalar(item)) item.type = "PLAIN";
      else if (isMap(item)) {
        const id = item.get("id", true);
        if (isScalar(id)) id.type = "PLAIN";
        const gap = item.get("gap", true) as unknown as YAMLMap;
        const sev = gap.get("severity", true);
        if (isScalar(sev)) sev.type = "PLAIN";
        (gap.get("bridge", true) as unknown as YAMLSeq).flow = true;
      }
    }
  }
};

export async function applyRoadmaps(ctx: Context, dir: string, opts: { dry?: boolean } = {}) {
  const { catalog } = await loadAppCatalog(ctx);
  const docs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as unknown)
    .filter((d): d is object => !!d && typeof d === "object" && "topic" in d)
    .map((d) => RoadmapSchema.parse(d));
  const plan = planRoadmaps(docs, new Map(catalog.books.map((b) => [b.id, b.level])));
  console.log(plan.report.join("\n"));
  console.log(`fuentes con plan: ${plan.edges.size}; errores: ${plan.errors.length}`);
  if (plan.errors.length) console.log(plan.errors.join("\n"));
  if (opts.dry) return plan;

  for (const [src, edges] of plan.edges) {
    const file = bookFile(ctx.contentDir, src);
    const doc = readBookDoc(file);
    if (edges.length) leadsToNode(doc, leadsToValue(edges));
    else (doc.contents as YAMLMap).delete("leadsTo");
    writeDoc(file, doc);
  }
  for (const b of catalog.books) {
    const lv = plan.levels.get(b.id)!;
    if (lv === b.level) continue;
    const file = bookFile(ctx.contentDir, b.id);
    const doc = readBookDoc(file);
    setField(doc, "level", lv);
    writeDoc(file, doc);
  }
  await revalidate(ctx, "apply-roadmaps");
  return plan;
}

export async function applyCalibration(ctx: Context, file: string) {
  const { decisions } = readJson(file, CalibrationSchema);
  const bySrc = new Map<string, typeof decisions>();
  for (const d of decisions) bySrc.set(d.from, [...(bySrc.get(d.from) ?? []), d]);
  const stats = { fuerte: 0, "muy-fuerte": 0, ninguno: 0, "sin-decision": 0 };
  for (const [src, ds] of bySrc) {
    const path_ = bookFile(ctx.contentDir, src);
    if (!fs.existsSync(path_)) {
      console.warn(`  ${src}: no existe`);
      continue;
    }
    const doc = readBookDoc(path_);
    const seq = (doc.contents as YAMLMap).get("leadsTo", true);
    if (!isSeq(seq)) continue;
    const value: LeadsTo = seq.items.map((item) => {
      if (isScalar(item)) return String(item.value);
      const m = item as YAMLMap;
      const id = String(m.get("id"));
      const d = ds.find((x) => x.to === id);
      const gap = (m.get("gap", true) as unknown as YAMLMap).toJSON() as { severity: string; bridge: string[]; note?: string };
      if (!d) {
        stats["sin-decision"]++;
        return { id, gap };
      }
      stats[d.severity]++;
      if (d.severity === "ninguno") return id;
      return { id, gap: { severity: d.severity, bridge: d.bridge.slice(0, 5), ...(d.note ? { note: d.note } : {}) } };
    });
    leadsToNode(doc, value);
    writeDoc(path_, doc);
  }
  console.log(stats);
  await revalidate(ctx, "apply-calibration");
}

/** routes.yaml con cabecera, corrientes primero y después objetivos; dentro de cada grupo, el orden de la propuesta. */
export function routesYaml(routes: readonly WrittenRoute[], proposalOrder: readonly string[], creatorName: string): string {
  const q = (s: string) => JSON.stringify(s);
  const rank = new Map(proposalOrder.map((id, i) => [id, i]));
  const kept = routes.filter((r) => !r.discarded).sort((a, b) => Number(a.kind !== "corriente") - Number(b.kind !== "corriente") || (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  const lines = [
    "# yaml-language-server: $schema=./routes.schema.json",
    `# Rutas: itinerarios de lectura curados. Formato y reglas en el schema; cada paso cita la fuente de ${creatorName}`,
    `# (source = índice en book.sources) y \`order\` solo va cuando ${creatorName} dictó ese orden.`,
  ];
  for (const r of kept) {
    lines.push("", `- id: ${r.id}`, `  name: ${q(r.name)}`, `  kind: ${r.kind}`, `  line: ${r.line}`, `  promise: ${q(r.promise)}`, `  summary: ${q(r.summary)}`, "  steps:");
    for (const s of r.steps) {
      lines.push(`    - book: ${s.book}`);
      if (s.optional) lines.push("      optional: true");
      if (s.gap) {
        lines.push("      gap:", `        severity: ${s.gap.severity}`, "        bridge:", ...s.gap.bridge.map((b) => `          - ${q(b)}`));
        if (s.gap.note) lines.push(`        note: ${q(s.gap.note)}`);
      }
      lines.push(`      why: ${q(s.why)}`);
      if (s.source !== undefined && s.source !== null) lines.push(`      source: ${s.source}`);
      if (s.order) {
        lines.push("      order:", `        url: ${q(s.order.url)}`);
        if (s.order.timestamp) lines.push(`        timestamp: ${q(s.order.timestamp)}`);
        lines.push(`        quote: ${q(s.order.quote)}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

export async function routesAssemble(ctx: Context, outDir: string, proposalFile: string) {
  const creator = await loadCreator(ctx);
  const routes = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson(path.join(outDir, f), WrittenRouteFileSchema))
    .filter((r): r is WrittenRoute => !r.discarded);
  const proposal = readJson(proposalFile, RouteProposalSchema);
  const text = routesYaml(routes, proposal.routes.map((r) => r.id), creator.name);
  fs.writeFileSync(path.join(ctx.contentDir, "routes.yaml"), text);
  console.log(`routes-assemble: ${routes.filter((r) => !r.discarded).length} ruta(s) → content/routes.yaml`);
  await revalidate(ctx, "routes-assemble");
}

async function revalidate(ctx: Context, cmd: string) {
  try {
    loadCatalogFrom(await loadCatalogDef(ctx), ctx.contentDir);
    console.log(`${cmd}: el catálogo valida`);
  } catch (e) {
    console.error(`${cmd}: el catálogo no valida; revisá los cambios.\n${(e as Error).message}`);
    process.exitCode = 1;
  }
}
