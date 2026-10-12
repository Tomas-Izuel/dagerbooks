/**
 * Invariantes del layout de la vista Subte, sobre el catálogo real, para las 3 densidades
 * y para el foco de cada línea. `pnpm check:subway`. Sale con código 1 si alguno falla.
 */
import { loadCatalog } from "../lib/catalog/load";
import { computeSubwayLayout, SUBWAY_DENSITY_PRESETS, DEFAULT_SUBWAY_CONFIG } from "../lib/catalog/subway";
import { computeSubwayFocusLayout, FOCUS_LANE_SCALE } from "../lib/catalog/subway-focus";
import type { SubwayBook, SubwayLayout } from "../lib/catalog/subway.types";
import { DENSITIES } from "../lib/density";

/** Tope de cruces con aristas secundarias (libros con más de un padre en su línea), fijado con el primer resultado real. */
const SECONDARY_CROSSINGS_CAP = 2;
const EPS = 1e-6;

type Pt = readonly [number, number];
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, msg: string) => {
  checks++;
  if (!cond) {
    failures.push(msg);
  }
};

const { books, topics } = loadCatalog();
const root = books.find((b) => b.level === 0)!;
const fromRoot = new Set(root.leadsTo ?? []);
const bookById = new Map(books.map((b) => [b.id, b]));
const topicIdx = new Map(topics.map((t, i) => [t.id, i]));

const catalog = {
  topics: topics.map((t) => ({ id: t.id })),
  books: books.map(
    (b): SubwayBook => ({
      id: b.id,
      level: b.level,
      primaryTopic: b.topics[0] ?? null,
      leadsTo: b.leadsTo,
      related: b.related,
      title: b.title,
      recommendation: b.recommendation,
      entry: fromRoot.has(b.id),
    }),
  ),
};
const focusBooks = books.map((b) => ({
  id: b.id,
  level: b.level,
  topics: b.topics,
  leadsTo: b.leadsTo,
  title: b.title,
  recommendation: b.recommendation,
}));
const related = books.flatMap((b) => (b.related ?? []).map((r) => ({ from: b.id, to: r.id, reason: r.reason })));

const orient = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const properCross = (p: Pt, q: Pt, r: Pt, s: Pt) => orient(p, q, r) * orient(p, q, s) < -EPS && orient(r, s, p) * orient(r, s, q) < -EPS;
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

interface Report {
  label: string;
  ms: number;
  secondary: number;
  lanes: number[];
}

function checkLayout(label: string, l: SubwayLayout, expected: readonly string[], pitch: number, topicOrder: readonly string[]): number {
  const cfg = l.config;
  const at = (m: string) => `[${label}] ${m}`;
  const nodeById = new Map(l.nodes.map((n) => [n.id, n]));

  // 8. cobertura: ninguna estación se pierde, cada una tiene rol
  ok(l.nodes.length === expected.length, at(`estaciones ${l.nodes.length} != ${expected.length}`));
  for (const id of expected) ok(nodeById.has(id), at(`falta la estación "${id}"`));
  const roles = new Map<string, number>();
  for (const n of l.nodes) roles.set(n.role, (roles.get(n.role) ?? 0) + 1);
  const nonRoot = [...roles].filter(([r]) => r !== "root").reduce((a, [, c]) => a + c, 0);
  ok(nonRoot === expected.length - 1, at(`raíces+ramas+rieles+islas = ${nonRoot}, esperado ${expected.length - 1}`));

  // 2. todo segmento a 0, 45 o 90 grados
  for (const e of l.edges) {
    const pts = e.pts;
    ok(!!pts && pts.length >= 2 && !!e.mid, at(`arista ${e.from}>${e.to} sin pts/mid`));
    if (!pts) continue;
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
      const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
      ok(dx < EPS || dy < EPS || Math.abs(dx - dy) < EPS, at(`segmento fuera de 0/45/90 en ${e.from}>${e.to}: dx=${dx} dy=${dy}`));
    }
    // extremos sobre las estaciones (en Km 0, sobre la píldora)
    const a = nodeById.get(e.from)!;
    const b = nodeById.get(e.to)!;
    const start: Pt = a.level === 0 ? [l.pill.x, b.y] : [a.x, a.y];
    ok(Math.hypot(pts[0][0] - start[0], pts[0][1] - start[1]) < 1e-3, at(`${e.from}>${e.to} no arranca en su origen`));
    const end = pts[pts.length - 1];
    ok(Math.hypot(end[0] - b.x, end[1] - b.y) < 1e-3, at(`${e.from}>${e.to} no termina en su destino`));
  }

  // 3. x crece con el nivel; el nivel n está en la columna de la zona n
  for (const e of l.edges) {
    if (e.kind === "related") continue;
    const a = nodeById.get(e.from)!;
    const b = nodeById.get(e.to)!;
    ok(b.x > a.x, at(`leadsTo ${e.from}>${e.to}: x_to (${b.x}) no supera a x_from (${a.x})`));
  }
  const zoneOf = new Map(l.zones.map((z) => [z.level, z]));
  for (const n of l.nodes) {
    if (n.level === 0) continue;
    const z = zoneOf.get(n.level);
    ok(!!z && n.x >= z.x0 && n.x <= z.x1, at(`"${n.id}" (nivel ${n.level}) fuera de su zona`));
    if (z && n.role !== "rail") ok(n.x === z.x, at(`"${n.id}" no está en la columna de la zona ${n.level}`));
  }

  // 4. estaciones separadas
  const minDist = 2 * cfg.nodeRadius + 8;
  ok(l.minNodeDistance >= minDist, at(`distancia mínima ${l.minNodeDistance} < ${minDist}`));

  // 5. cruces: se recalculan acá, de forma independiente
  const bandOfEdge = (e: (typeof l.edges)[number]): number | null => {
    if (e.kind === "related") return null;
    const a = nodeById.get(e.from)!;
    const b = nodeById.get(e.to)!;
    if (a.level === 0) return b.band;
    return a.band === b.band ? a.band : null;
  };
  const perBand = new Map<number, (typeof l.edges)[number][]>();
  for (const e of l.edges) {
    const bd = bandOfEdge(e);
    if (bd !== null) (perBand.get(bd) ?? perBand.set(bd, []).get(bd)!).push(e);
  }
  let geo = 0;
  for (const es of perBand.values()) {
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i].pts!;
        const b = es[j].pts!;
        for (let x = 1; x < a.length; x++) for (let y = 1; y < b.length; y++) if (properCross(a[x - 1], a[x], b[y - 1], b[y])) geo++;
      }
    }
  }
  ok(l.crossings.tree === 0, at(`crossings.tree = ${l.crossings.tree} (debe ser 0)`));
  ok(geo === l.crossings.tree + l.crossings.secondary, at(`cruces recalculados ${geo} != informados ${l.crossings.tree + l.crossings.secondary}`));
  ok(l.crossings.secondary <= SECONDARY_CROSSINGS_CAP, at(`crossings.secondary = ${l.crossings.secondary} supera el tope ${SECONDARY_CROSSINGS_CAP}`));

  // alcanzabilidad por las vías (leadsTo + implicitRoot): también sirve para reconocer aristas transitivas
  const out = new Map<string, string[]>();
  for (const e of l.edges) if (e.kind !== "related") (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e.to);
  const reachFrom = (starts: readonly string[]) => {
    const seen = new Set(starts);
    const stack = [...starts];
    while (stack.length) {
      for (const t of out.get(stack.pop()!) ?? []) {
        if (seen.has(t)) continue;
        seen.add(t);
        stack.push(t);
      }
    }
    return seen;
  };
  const rootId = l.nodes.find((n) => n.level === 0)!.id;

  // ninguna vía de un árbol pasa por detrás de una estación ajena (el riel de Km 0 sí, a propósito).
  // Excepción: una arista transitiva (A>C con A>B>C) que corre recta sobre B se superpone con el tronco.
  for (const e of l.edges) {
    if (e.kind === "related" || nodeById.get(e.from)!.level === 0 || !e.pts) continue;
    for (const n of l.nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      for (let i = 1; i < e.pts.length; i++) {
        if (distToSegment([n.x, n.y], e.pts[i - 1], e.pts[i]) < cfg.nodeRadius * 0.6) {
          const transitive = reachFrom([e.from]).has(n.id) && reachFrom([n.id]).has(e.to);
          ok(bandOfEdge(e) === null || transitive, at(`la vía ${e.from}>${e.to} atraviesa la estación "${n.id}"`));
        }
      }
    }
  }

  // 6. bandas, bounds, zonas
  for (let i = 0; i < l.bands.length; i++) {
    const b = l.bands[i];
    ok(b.y1 > b.y0, at(`banda ${b.topicId} sin altura`));
    ok(b.topicId === topicOrder[i], at(`banda ${i} es ${b.topicId}, esperado ${topicOrder[i]}`));
    if (i > 0) ok(b.y0 >= l.bands[i - 1].y1, at(`la banda ${b.topicId} se solapa con la anterior`));
  }
  const { bounds } = l;
  const inside = (x: number, y: number) => x >= bounds.minX - EPS && x <= bounds.maxX + EPS && y >= bounds.minY - EPS && y <= bounds.maxY + EPS;
  for (const n of l.nodes) {
    ok(inside(n.x, n.y), at(`"${n.id}" fuera de bounds`));
    if (n.band >= 0) {
      const b = l.bands[n.band];
      ok(n.y >= b.y0 && n.y <= b.y1, at(`"${n.id}" fuera de la banda ${b.topicId}`));
      ok(n.sector === b.topicId, at(`"${n.id}" tiene sector ${n.sector}, está en la banda ${b.topicId}`));
    }
  }
  for (const e of l.edges) for (const p of e.pts ?? []) ok(inside(p[0], p[1]), at(`un vértice de ${e.from}>${e.to} queda fuera de bounds`));
  ok(Math.abs(bounds.width - (bounds.maxX - bounds.minX)) < 1e-3 && Math.abs(bounds.height - (bounds.maxY - bounds.minY)) < 1e-3, at("bounds.width/height incoherentes"));
  for (const n of l.nodes) {
    if (n.level === 0) continue;
    const b = bookById.get(n.id)!;
    ok(n.band === (l.bands.length === 1 ? 0 : topicIdx.get(b.topics[0])!), at(`"${n.id}" no aparece en su banda`));
  }

  // 9. alcanzabilidad desde Km 0. En el foco, una isla (nivel 2+ sin padre en la línea) y lo que cuelga
  // de ella no tienen vía de entrada por diseño: se piden alcanzables desde Km 0 o desde una isla.
  const islands = l.nodes.filter((n) => n.role === "island").map((n) => n.id);
  const seen = reachFrom([rootId, ...(l.bands.length === 1 ? islands : [])]);
  if (l.bands.length > 1) {
    // Mapa completo: las islas cuelgan de una vía de otra línea, así que todo es alcanzable desde Km 0.
    for (const n of l.nodes) ok(seen.has(n.id), at(`"${n.id}" no es alcanzable desde Km 0`));
  } else {
    for (const n of l.nodes) ok(seen.has(n.id), at(`"${n.id}" no es alcanzable desde Km 0 ni desde una isla`));
  }
  // Km 0: toda vía de Km 0 arranca sobre la píldora, a la altura de su fila
  for (const e of l.edges) {
    if (e.from !== rootId) continue;
    const y = e.pts![0][1];
    ok(y >= l.pill.y0 - EPS && y <= l.pill.y1 + EPS, at(`la vía de Km 0 a ${e.to} sale fuera de la píldora`));
  }
  return geo;
}

const orderIds = topics.map((t) => t.id);
const reports: Report[] = [];
const sizes: string[] = [];

for (const d of DENSITIES) {
  const cfg = SUBWAY_DENSITY_PRESETS[d];
  const t0 = performance.now();
  const l = computeSubwayLayout(catalog, cfg);
  const ms = performance.now() - t0;
  const again = computeSubwayLayout(catalog, cfg);
  ok(JSON.stringify(l) === JSON.stringify(again), `[${d}] dos corridas dieron distinto resultado`);
  ok(ms < 30, `[${d}] el layout tardó ${ms.toFixed(1)} ms (objetivo < 30 ms)`);
  const pitch = cfg.lanePitch ?? DEFAULT_SUBWAY_CONFIG.lanePitch;
  const sec = checkLayout(d, l, books.map((b) => b.id), pitch, orderIds);
  const lanes = l.bands.map((b) => Math.round((b.y1 - b.y0) / pitch));
  reports.push({ label: d, ms, secondary: sec, lanes });
  sizes.push(`${d.padEnd(8)} ${String(l.bounds.width).padStart(8)} x ${String(l.bounds.height).padStart(8)}   cruces tree=${l.crossings.tree} secondary=${l.crossings.secondary}   ${ms.toFixed(1)} ms`);
  if (d === "compacta") {
    console.log("Carriles por línea (compacta):");
    console.log(l.bands.map((b, i) => `  ${String.fromCharCode(65 + i)} ${b.topicId.padEnd(20)} ${String(b.count).padStart(3)} libros  ${String(lanes[i]).padStart(2)} carriles`).join("\n"));
  }
}

console.log("\nTamaño de la geometría completa (ancho x alto, px):");
console.log(sizes.join("\n"));

// Foco de cada línea, en las 3 densidades
const focusSizes: string[] = [];
for (const d of DENSITIES) {
  const cfg = SUBWAY_DENSITY_PRESETS[d];
  const pitch = (cfg.lanePitch ?? DEFAULT_SUBWAY_CONFIG.lanePitch) * FOCUS_LANE_SCALE;
  let maxW = 0;
  let maxH = 0;
  let maxMs = 0;
  for (const t of topics) {
    const t0 = performance.now();
    const f = computeSubwayFocusLayout(focusBooks, related, t.id, cfg);
    maxMs = Math.max(maxMs, performance.now() - t0);
    const again = computeSubwayFocusLayout(focusBooks, related, t.id, cfg);
    ok(JSON.stringify(f.layout) === JSON.stringify(again.layout), `[foco ${d}/${t.id}] no es determinista`);
    const expected = books.filter((b) => b.level === 0 || b.topics.includes(t.id)).map((b) => b.id);
    ok(f.count === expected.length - 1, `[foco ${d}/${t.id}] count ${f.count} != ${expected.length - 1}`);
    checkLayout(`foco ${d}/${t.id}`, f.layout, expected, pitch, [t.id]);
    maxW = Math.max(maxW, f.layout.bounds.width);
    maxH = Math.max(maxH, f.layout.bounds.height);
  }
  focusSizes.push(`${d.padEnd(8)} máx ${maxW} x ${maxH}   (más lento: ${maxMs.toFixed(1)} ms)`);
}
console.log("\nFoco por línea, máximos de las 12 líneas (ancho x alto, px):");
console.log(focusSizes.join("\n"));

if (failures.length) {
  const unique = [...new Set(failures)];
  console.error(`\nFALLÓ: ${unique.length} problema(s) en ${checks} comprobaciones.`);
  for (const f of unique.slice(0, 60)) console.error(`  - ${f}`);
  if (unique.length > 60) console.error(`  ... y ${unique.length - 60} más`);
  process.exit(1);
}
console.log(`\nOK: ${checks} comprobaciones, ${books.length} libros, ${topics.length} líneas, ${DENSITIES.length} densidades + foco de cada línea.`);
