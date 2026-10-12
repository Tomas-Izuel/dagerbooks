/**
 * Layout de la vista Subte: bandas horizontales por línea, niveles como zonas en columnas
 * alineadas entre líneas, Km 0 como una estación larga vertical a la izquierda.
 * Puro, determinista y sin dependencias de Node, Zod ni React: corre igual en servidor y cliente.
 *
 * Cada línea es un bosque con raíz en Km 0:
 *  - tronco: el camino pesado del árbol de la estación de entrada, en el carril 0 (recto);
 *  - ramas: un `leadsTo` que no sigue el camino pesado se bifurca a 45° justo después del padre
 *    y sigue paralelo en un carril contiguo;
 *  - riel de cabecera: los libros de nivel 1 sin hijos, en filas fuera de la extensión del árbol,
 *    sobre un riel que sale de Km 0 (no tienen orden entre sí);
 *  - islas: nivel 2+ sin padre en su línea.
 * Los carriles se asignan con una grilla de ocupación (carril x ranura): la ranura 2z es la
 * columna de la zona z y la 2z-1 su hueco de entrada, donde viven las diagonales.
 * Los trazos usan solo 0°, 45° y 90°.
 */
import type { Density } from "../density";
import type { LayoutBounds, LayoutEdge, LayoutEdgeKind } from "./layout.types";
import type {
  SubwayBand,
  SubwayBook,
  SubwayCatalog,
  SubwayCrossings,
  SubwayLabelSlot,
  SubwayLayout,
  SubwayLayoutConfig,
  SubwayNode,
  SubwayRole,
  SubwayZone,
} from "./subway.types";

export type * from "./subway.types";

export const DEFAULT_SUBWAY_CONFIG: SubwayLayoutConfig = {
  lanePitch: 34,
  colPitch: 120,
  zoneGapMin: 150,
  forkMargin: 22,
  bandGap: 28,
  pillWidth: 28,
  headerWidth: 220,
  zoneHeaderHeight: 56,
  maxRailRows: 3,
  nodeRadius: 11,
  trackCorner: 12,
  precision: 2,
};

/** Espaciado por densidad. `compacta` es la base. Las marcas escalan con `DENSITY_SCALE`. */
export const SUBWAY_DENSITY_PRESETS: Record<Density, Partial<SubwayLayoutConfig>> = {
  compacta: {},
  media: { lanePitch: 44, colPitch: 160, zoneGapMin: 190, bandGap: 40 },
  aireada: { lanePitch: 56, colPitch: 210, zoneGapMin: 240, bandGap: 56 },
};

const MAX_LEVEL = 4;
const CHANNELS = 4;
const CHANNEL_STEP = 5;
/** Distancia de la columna al primer canal vertical de conectores (px). */
const CHANNEL_BASE = 26;
const MAX_SPAN = 60;
const LIGHT_SPAN = 16;
const EPS = 1e-6;

type Pt = [number, number];

interface Claim {
  chain: string;
  fan?: string;
}

interface BNode {
  id: string;
  book: SubwayBook;
  level: number;
  /** Padre primario dentro de la línea. */
  parent: string | null;
  /** Orígenes secundarios dentro de la línea (aristas que se unen). */
  sec: string[];
  /** Hijos primarios, el pesado primero. */
  kids: string[];
  depth: number;
  size: number;
  descendants: number;
  /** Cuelga de Km 0 (nivel 1 o destino explícito de Km 0). */
  leadIn: boolean;
  entry: boolean;
  lane: number;
  placed: boolean;
  chain: string;
  trunk: boolean;
  rail: boolean;
  sub: number;
}

interface Route {
  from: string;
  to: string;
  secondary: boolean;
  /** Zona cuyo hueco de entrada aloja la diagonal. */
  forkZone: number;
  /** Sin carril limpio: se dibuja como puente por un canal vertical, sin pisar estaciones. */
  bypass?: boolean;
  /** Carril intermedio por el que corre la unión (diagonal de salida y de entrada en huecos distintos). */
  via?: number;
}

interface BandPlan {
  topicId: string;
  index: number;
  nodes: Map<string, BNode>;
  minLane: number;
  maxLane: number;
  rails: BNode[];
  /** Carriles usados por las uniones con carril intermedio. */
  viaLo: number;
  viaHi: number;
  /** Cruces forzados y tamaño: menor es mejor. */
  score: number;
  entryId: string | null;
  routes: Route[];
  /** Δ de carriles máximo por zona de entrada (2..4). */
  forkSpan: number[];
  y0: number;
  y1: number;
  spineY: number;
}

const REC_RANK: Record<string, number> = { fuerte: 0, interesante: 1, mencion: 2 };
const recRank = (b: SubwayBook) => REC_RANK[b.recommendation ?? "interesante"] ?? 1;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function computeSubwayLayout(catalog: SubwayCatalog, partial: Partial<SubwayLayoutConfig> = {}): SubwayLayout {
  const cfg: SubwayLayoutConfig = { ...DEFAULT_SUBWAY_CONFIG, ...partial };
  const k = 10 ** cfg.precision;
  const rnd = (v: number) => {
    const r = Math.round(v * k) / k;
    return r === 0 ? 0 : r;
  };
  const { books, topics } = catalog;
  const byId = new Map(books.map((b) => [b.id, b]));
  const root = books.find((b) => b.level === 0);
  const topicIndex = new Map(topics.map((t, i) => [t.id, i]));
  const pitch = cfg.lanePitch;
  const fm = cfg.forkMargin;

  for (const b of books) {
    if (b.level === 0) continue;
    if (b.primaryTopic === null || !topicIndex.has(b.primaryTopic)) {
      throw new Error(`subway: libro "${b.id}" tiene un tema principal desconocido (${String(b.primaryTopic)})`);
    }
  }

  const explicitFromRoot = new Set<string>();
  if (root) for (const to of root.leadsTo ?? []) if (byId.has(to)) explicitFromRoot.add(to);
  const isEntry = (b: SubwayBook) => (b.entry !== undefined ? b.entry : explicitFromRoot.has(b.id));

  // ---- 1. un plan por banda -------------------------------------------------
  // Cada banda se resuelve con unas pocas variantes del orden de colocación y se queda con la de menos
  // cruces (luego menos carriles). Es barato: una banda tiene unas decenas de estaciones.
  const VARIANTS = 24;
  const plans: BandPlan[] = topics.map((t, index) => {
    let best: BandPlan | null = null;
    for (let v = 0; v < VARIANTS; v++) {
      let plan: BandPlan;
      try {
        plan = planBand(t.id, index, v);
      } catch (err) {
        if (v === VARIANTS - 1 && !best) throw err;
        continue;
      }
      if (!best || plan.score < best.score) best = plan;
      if (best.score < 1000) break; // sin cruces forzados: no hace falta seguir
    }
    return best!;
  });

  function planBand(topicId: string, index: number, variant: number): BandPlan {
    const members = books.filter((b) => b.level >= 1 && b.primaryTopic === topicId);
    const nodes = new Map<string, BNode>();
    for (const b of members) {
      nodes.set(b.id, {
        id: b.id,
        book: b,
        level: Math.min(b.level, MAX_LEVEL),
        parent: null,
        sec: [],
        kids: [],
        depth: 1,
        size: 1,
        descendants: 0,
        leadIn: b.level === 1 || explicitFromRoot.has(b.id),
        entry: isEntry(b),
        lane: 0,
        placed: false,
        chain: b.id,
        trunk: false,
        rail: false,
        sub: 0,
      });
    }
    const parentsOf = new Map<string, string[]>();
    for (const b of members) {
      for (const to of b.leadsTo ?? []) {
        if (!nodes.has(to) || to === b.id) continue;
        (parentsOf.get(to) ?? parentsOf.set(to, []).get(to)!).push(b.id);
      }
    }
    // Descendientes alcanzables (en el DAG de la línea): desempate del padre primario.
    const reachMemo = new Map<string, Set<string>>();
    const reachOf = (id: string): Set<string> => {
      const hit = reachMemo.get(id);
      if (hit) return hit;
      const s = new Set<string>();
      reachMemo.set(id, s);
      for (const to of byId.get(id)?.leadsTo ?? []) {
        if (!nodes.has(to) || to === id) continue;
        s.add(to);
        for (const x of reachOf(to)) s.add(x);
      }
      return s;
    };
    for (const n of nodes.values()) n.descendants = reachOf(n.id).size;

    for (const [to, ps] of parentsOf) {
      const sorted = [...new Set(ps)].sort(
        (a, b) =>
          nodes.get(b)!.level - nodes.get(a)!.level ||
          nodes.get(b)!.descendants - nodes.get(a)!.descendants ||
          cmp(a, b),
      );
      const n = nodes.get(to)!;
      n.parent = sorted[0];
      n.sec = sorted.slice(1);
    }
    for (const n of nodes.values()) if (n.parent) nodes.get(n.parent)!.kids.push(n.id);

    // profundidad y tamaño del bosque primario (hijos siempre de mayor nivel: sin ciclos)
    const byLevelDesc = [...nodes.values()].sort((a, b) => b.level - a.level);
    for (const n of byLevelDesc) {
      let depth = 0;
      let size = 1;
      for (const c of n.kids) {
        const cn = nodes.get(c)!;
        depth = Math.max(depth, cn.depth);
        size += cn.size;
      }
      n.depth = 1 + depth;
      n.size = size;
    }
    const kidOrder = (a: string, b: string) => {
      const x = nodes.get(a)!;
      const y = nodes.get(b)!;
      return y.depth - x.depth || y.size - x.size || recRank(x.book) - recRank(y.book) || cmp(a, b);
    };
    for (const n of nodes.values()) n.kids.sort(kidOrder);

    const roots = [...nodes.values()].filter((n) => !n.parent);
    // Un libro de nivel 1 sin hijos y sin ningún leadsTo dentro de la línea es una parada de cabecera.
    // Si tiene un leadsTo secundario (se une a otro libro) es un árbol de una estación, con carril propio.
    const hasOut = (n: BNode) => (byId.get(n.id)?.leadsTo ?? []).some((to) => nodes.has(to) && to !== n.id);
    const rails = roots.filter((n) => n.leadIn && n.kids.length === 0 && !hasOut(n));
    for (const r of rails) r.rail = true;
    const trees = roots.filter((n) => !n.rail);
    const weight = (a: BNode, b: BNode) =>
      Number(b.leadIn) - Number(a.leadIn) || b.depth - a.depth || b.size - a.size || a.level - b.level || cmp(a.id, b.id);
    trees.sort(weight);
    const leadTrees = trees.filter((t) => t.leadIn);
    const trunkRoot =
      leadTrees.find((t) => t.entry) ??
      leadTrees[0] ??
      null;
    if (trunkRoot) {
      trees.splice(trees.indexOf(trunkRoot), 1);
      trees.unshift(trunkRoot);
    }
    // Las variantes altas también rotan el orden de los árboles que no son el tronco.
    const rot = variant >> 2;
    if (rot > 0 && trees.length > 2) {
      const rest = trees.slice(1);
      const k = rot % rest.length;
      trees.splice(1, rest.length, ...rest.slice(k), ...rest.slice(0, k));
    }

    // ---- grilla de ocupación ----
    let grid = new Map<number, Claim[]>();
    const key = (lane: number, slot: number) => (lane + 1000) * 16 + slot;
    type Cell = { lane: number; slot: number; claim: Claim };
    const conflicts = (cell: Cell) => {
      const ex = grid.get(key(cell.lane, cell.slot));
      if (!ex) return false;
      return ex.some((c) => c.chain !== cell.claim.chain && !(cell.claim.fan && c.fan === cell.claim.fan));
    };
    const allFree = (cells: Cell[]) => cells.every((c) => !conflicts(c));
    const commit = (cells: Cell[]) => {
      for (const c of cells) {
        const kk = key(c.lane, c.slot);
        const arr = grid.get(kk) ?? grid.set(kk, []).get(kk)!;
        if (!arr.some((x) => x.chain === c.claim.chain && x.fan === c.claim.fan)) arr.push(c.claim);
      }
    };

    const chainOf = (head: BNode): BNode[] => {
      const out = [head];
      let cur = head;
      while (cur.kids.length) {
        cur = nodes.get(cur.kids[0])!;
        out.push(cur);
      }
      return out;
    };
    const headCells = (head: BNode, lane: number): Cell[] => {
      const chain = chainOf(head);
      const last = chain[chain.length - 1];
      const cells: Cell[] = [];
      const parent = head.parent ? nodes.get(head.parent)! : null;
      let start: number;
      if (parent) start = 2 * parent.level + 1;
      else if (head.leadIn) start = 1;
      else start = 2 * head.level;
      for (let s = start; s <= 2 * last.level; s++) {
        cells.push({ lane, slot: s, claim: { chain: head.id, fan: parent && s === start ? parent.id : undefined } });
      }
      if (parent) {
        const lo = Math.min(parent.lane, lane);
        const hi = Math.max(parent.lane, lane);
        for (let l = lo; l <= hi; l++) {
          if (l === parent.lane || l === lane) continue;
          cells.push({ lane: l, slot: start, claim: { chain: head.id, fan: parent.id } });
        }
      }
      return cells;
    };
    const lanesNear = (center: number, prefer: 1 | -1, span: number): number[] => {
      const out = [center];
      for (let d = 1; d <= span; d++) out.push(center + prefer * d, center - prefer * d);
      return out;
    };
    // ---- colocación: tronco, luego árboles por peso. Cada subárbol se coloca entero, en profundidad,
    // y si una rama no encuentra salida se deshace y se prueba otro carril para su cabecera. ----
    const subtreeOf = (head: BNode): BNode[] => {
      const out: BNode[] = [];
      const walk = (n: BNode) => {
        out.push(n);
        for (const c of n.kids) walk(nodes.get(c)!);
      };
      walk(head);
      return out;
    };
    const snapshot = () => new Map([...grid].map(([kk, v]) => [kk, v.map((c) => ({ ...c }))]));
    /** Carril al que conviene acercar un libro con varios padres: el promedio de los que ya están colocados. */
    const targetLane = (kid: BNode, parent: BNode): number => {
      const lanes = [parent.lane];
      for (const sid of kid.sec) {
        const sn = nodes.get(sid)!;
        if (sn.placed) lanes.push(sn.lane);
      }
      return lanes.reduce((a, c) => a + c, 0) / lanes.length;
    };
    const placeSubtree = (head: BNode, lane: number): boolean => {
      if (!allFree(headCells(head, lane))) return false;
      const before = snapshot();
      commit(headCells(head, lane));
      const chain = chainOf(head);
      for (const n of chain) {
        n.lane = lane;
        n.placed = true;
        n.chain = head.id;
      }
      for (const n of chain) {
        n.kids.slice(1).forEach((cid, i) => {
          if (!ok) return;
          const kid = nodes.get(cid)!;
          const target = targetLane(kid, n);
          const cands = lanesNear(n.lane, (i + (variant >> 1)) % 2 === 0 ? 1 : -1, LIGHT_SPAN);
          cands.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
          for (const cand of cands) {
            if (placeSubtree(kid, cand)) return;
          }
          ok = false;
        });
        if (!ok) break;
      }
      if (!ok) {
        ok = true;
        grid = before;
        for (const n of subtreeOf(head)) n.placed = false;
        return false;
      }
      return true;
    };
    let ok = true;
    let treeIdx = 0;
    for (const t of trees) {
      const prefer: 1 | -1 = (treeIdx++ + variant) % 2 === 0 ? 1 : -1;
      let done = false;
      // Se acerca al árbol con el que comparte libros (los que tienen padres en dos árboles).
      const inTree = new Set(subtreeOf(t).map((n) => n.id));
      const tl: number[] = [];
      for (const n of nodes.values()) {
        for (const pid of [n.parent, ...n.sec]) {
          if (!pid) continue;
          const pn = nodes.get(pid)!;
          if (inTree.has(n.id) && !inTree.has(pid) && pn.placed) tl.push(pn.lane);
          else if (!inTree.has(n.id) && inTree.has(pid) && n.placed) tl.push(n.lane);
        }
      }
      const tTarget = tl.length ? tl.reduce((a, c) => a + c, 0) / tl.length : 0;
      const tCands = lanesNear(0, prefer, MAX_SPAN).sort((a, b) => Math.abs(a - tTarget) - Math.abs(b - tTarget));
      for (const cand of tCands) {
        if (placeSubtree(t, cand)) {
          done = true;
          break;
        }
      }
      if (!done) throw new Error(`subway: no hay carril libre para "${t.id}" en la línea "${topicId}"`);
      if (t === trunkRoot) for (const n of chainOf(t)) n.trunk = true;
    }

    // ---- aristas secundarias (se unen a un nodo ya colocado) ----
    const routes: Route[] = [];
    const forkSpan = [0, 0, 0, 0, 0];
    const noteFork = (zone: number, span: number) => {
      if (zone >= 2 && zone <= MAX_LEVEL) forkSpan[zone] = Math.max(forkSpan[zone], span);
    };
    let forced = 0;
    let viaLo = 0;
    let viaHi = 0;
    let stationHits = 0;
    const members2 = [...nodes.values()];
    for (const n of members2) {
      if (!n.parent) continue;
      const p = nodes.get(n.parent)!;
      const forkZone = p.level + 1;
      routes.push({ from: p.id, to: n.id, secondary: false, forkZone });
      noteFork(forkZone, Math.abs(n.lane - p.lane));
    }
    for (const n of members2) {
      for (const sid of n.sec) {
        const s = nodes.get(sid)!;
        const vChain = nodes.get(n.chain)!.id;
        const lo = Math.min(s.lane, n.lane);
        const hi = Math.max(s.lane, n.lane);
        // La diagonal puede caer en el hueco de entrada de cualquier zona entre el origen y el destino.
        // Primero justo después del origen (se lee como una rama del origen), luego justo antes del destino.
        // La unión no puede caer antes de la estación que precede a `n` en su propio carril: se leería como
        // una vía que pasa por esa estación.
        const pp = n.parent ? nodes.get(n.parent)! : null;
        const zMin = Math.max(s.level + 1, pp && pp.lane === n.lane ? pp.level + 1 : 0);
        const zones: number[] = [zMin];
        if (n.level !== zMin) zones.push(n.level);
        for (let z = zMin + 1; z < n.level; z++) zones.push(z);
        let chosen = -1;
        let leastBad = zones[0];
        let leastCount = Infinity;
        for (const z of zones) {
          const x = `x:${s.id}>${n.id}`;
          const cells: Cell[] = [];
          const g = 2 * z - 1;
          if (z === s.level + 1) {
            for (let l = lo; l <= hi; l++) {
              // El carril del origen en este hueco es de su propia cadena (o queda reservado si la cadena ya terminó).
              if (l === s.lane && s.lane !== n.lane) cells.push({ lane: l, slot: g, claim: { chain: s.chain } });
              else cells.push({ lane: l, slot: g, claim: { chain: vChain, fan: s.id } });
            }
            for (let sl = g + 1; sl <= 2 * n.level - 1; sl++) cells.push({ lane: n.lane, slot: sl, claim: { chain: vChain } });
          } else {
            for (let sl = 2 * s.level + 1; sl <= g; sl++) cells.push({ lane: s.lane, slot: sl, claim: { chain: x } });
            for (let l = lo; l <= hi; l++) {
              if (l === s.lane || l === n.lane) continue;
              cells.push({ lane: l, slot: g, claim: { chain: x } });
            }
            for (let sl = g + 1; sl <= 2 * n.level - 1; sl++) cells.push({ lane: n.lane, slot: sl, claim: { chain: vChain } });
          }
          // Pisar una estación (ranura de columna) pesa mucho más que cruzar el hueco de otra vía.
          const bad = cells.reduce((acc, c) => acc + (conflicts(c) ? (c.slot % 2 === 0 ? 20 : 1) : 0), 0);
          if (bad === 0) {
            commit(cells);
            chosen = z;
            break;
          }
          if (bad < leastCount) {
            leastCount = bad;
            leastBad = z;
          }
        }
        // Tercer recurso: salir hacia un carril libre intermedio y entrar al destino desde ahí.
        let via: number | undefined;
        const z1 = s.level + 1;
        const z2 = n.level;
        if (chosen < 0 && z1 < z2) {
          let top = 0;
          let bottom = 0;
          for (const o of nodes.values()) {
            if (!o.placed) continue;
            top = Math.min(top, o.lane);
            bottom = Math.max(bottom, o.lane);
          }
          const ms: number[] = [];
          for (let m = top - 1; m <= bottom + 1; m++) if (m !== s.lane && m !== n.lane) ms.push(m);
          ms.sort((a, b) => Math.abs(a - s.lane) + Math.abs(a - n.lane) - (Math.abs(b - s.lane) + Math.abs(b - n.lane)) || a - b);
          for (const m of ms) {
            const x = `x:${s.id}>${n.id}`;
            const cells: Cell[] = [];
            for (let sl = 2 * z1 - 1; sl <= 2 * z2 - 1; sl++) cells.push({ lane: m, slot: sl, claim: { chain: x } });
            for (let l = Math.min(s.lane, m); l <= Math.max(s.lane, m); l++) {
              if (l !== s.lane && l !== m) cells.push({ lane: l, slot: 2 * z1 - 1, claim: { chain: x, fan: s.id } });
            }
            for (let l = Math.min(n.lane, m); l <= Math.max(n.lane, m); l++) {
              if (l !== n.lane && l !== m) cells.push({ lane: l, slot: 2 * z2 - 1, claim: { chain: x } });
            }
            if (allFree(cells)) {
              commit(cells);
              via = m;
              viaLo = Math.min(viaLo, m);
              viaHi = Math.max(viaHi, m);
              noteFork(z1, Math.abs(m - s.lane));
              noteFork(z2, Math.abs(m - n.lane));
              break;
            }
          }
        }
        if (via !== undefined) {
          routes.push({ from: s.id, to: n.id, secondary: true, forkZone: z1, via });
          continue;
        }
        // sin carril limpio: se acepta el cruce con la zona de menos choques (queda medido en `crossings.secondary`)
        if (chosen < 0) {
          forced++;
          if (leastCount >= 20) stationHits++;
        }
        const forkZone = chosen > 0 ? chosen : leastBad;
        routes.push({ from: s.id, to: n.id, secondary: true, forkZone, bypass: chosen < 0 });
        if (chosen >= 0) noteFork(forkZone, hi - lo);
      }
    }

    let minTreeLane = 0;
    let maxTreeLane = 0;
    for (const n of nodes.values()) {
      minTreeLane = Math.min(minTreeLane, n.lane);
      maxTreeLane = Math.max(maxTreeLane, n.lane);
    }
    // ---- riel de cabecera ----
    rails.sort(
      (a, b) =>
        Number(b.entry) - Number(a.entry) ||
        recRank(a.book) - recRank(b.book) ||
        cmp(a.book.title ?? a.id, b.book.title ?? b.id) ||
        cmp(a.id, b.id),
    );
    const members3 = [...nodes.values()];
    const entryNode =
      members3.find((n) => n.entry && n.leadIn && (n.trunk || n.rail)) ?? members3.find((n) => n.entry && n.leadIn) ?? null;
    return {
      topicId,
      index,
      nodes,
      rails,
      viaLo,
      viaHi,
      score: stationHits * 100000 + forced * 1000 + (maxTreeLane - minTreeLane) * 10 + forkSpan.reduce((a, c) => a + c, 0),
      minLane: 0,
      maxLane: 0,
      entryId: entryNode?.id ?? null,
      routes,
      forkSpan,
      y0: 0,
      y1: 0,
      spineY: 0,
    };
  }

  // ---- 2. subcolumnas del riel (global) y filas por banda -------------------------
  const maxRail = Math.max(0, ...plans.map((p) => p.rails.length));
  let S = 1;
  const rowsFor = (r: number, s: number) => Math.ceil(Math.ceil(r / s) / 2);
  while (S < 8 && rowsFor(maxRail, S) > cfg.maxRailRows) S++;

  for (const p of plans) {
    const rails = p.rails;
    const treeLanes = [...p.nodes.values()].filter((n) => n.placed);
    let minL = Math.min(0, p.viaLo, ...treeLanes.map((n) => n.lane));
    let maxL = Math.max(0, p.viaHi, ...treeLanes.map((n) => n.lane));
    let upNext = treeLanes.length ? minL - 1 : 0;
    let downNext = treeLanes.length ? maxL + 1 : 1;
    const nRows = Math.ceil(rails.length / S);
    for (let r = 0; r < nRows; r++) {
      const up = r % 2 === 0;
      const lane = up ? upNext-- : downNext++;
      for (let j = 0; j < S; j++) {
        const rail = rails[r * S + j];
        if (!rail) break;
        rail.lane = lane;
        rail.sub = j;
        rail.placed = true;
      }
      minL = Math.min(minL, lane);
      maxL = Math.max(maxL, lane);
    }
    p.minLane = minL;
    p.maxLane = maxL;
  }

  // ---- 3. columnas de zona globales ------------------------------------------------
  const presentLevels = new Set<number>();
  for (const b of books) if (b.level >= 1) presentLevels.add(Math.min(b.level, MAX_LEVEL));
  const maxZone = Math.max(1, ...presentLevels);
  const gapIn = (z: number) => {
    const span = Math.max(0, ...plans.map((p) => p.forkSpan[z]));
    return Math.max(cfg.zoneGapMin, span * pitch + 2 * fm);
  };
  const colX: number[] = [0, 0, 0, 0, 0];
  const zoneRange: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  const tail = CHANNEL_BASE + (CHANNELS - 1) * CHANNEL_STEP + 6;
  const railX0 = rnd(cfg.pillWidth / 2 + cfg.zoneGapMin * 0.6);
  colX[1] = rnd(railX0 + (S - 1) * cfg.colPitch);
  zoneRange[1] = [rnd(cfg.pillWidth / 2), rnd(colX[1] + tail)];
  for (let z = 2; z <= maxZone; z++) {
    colX[z] = rnd(zoneRange[z - 1][1] + gapIn(z));
    zoneRange[z] = [zoneRange[z - 1][1], rnd(colX[z] + tail)];
  }
  const chanX = (z: number, i: number) => rnd(colX[z] + CHANNEL_BASE + (i % CHANNELS) * CHANNEL_STEP);

  // ---- 4. alturas de banda ---------------------------------------------------------
  let cursor = 0;
  for (const p of plans) {
    p.y0 = rnd(cursor);
    const height = (p.maxLane - p.minLane + 1) * pitch;
    p.y1 = rnd(cursor + height);
    p.spineY = rnd(p.y0 + (0 - p.minLane + 0.5) * pitch);
    cursor = p.y1 + cfg.bandGap;
  }
  const laneY = (p: BandPlan, lane: number) => rnd(p.y0 + (lane - p.minLane + 0.5) * pitch);
  const first = plans[0];
  const last = plans[plans.length - 1];
  const pillY0 = first ? laneY(first, first.minLane) : 0;
  const pillY1 = last ? laneY(last, last.maxLane) : 0;
  const pill = { x: 0, y0: pillY0, y1: pillY1, width: cfg.pillWidth };

  // ---- 5. nodos ---------------------------------------------------------------------
  const pos = new Map<string, SubwayNode>();
  const bandOf = new Map<string, BandPlan>();
  if (root) {
    pos.set(root.id, {
      id: root.id,
      x: 0,
      y: rnd((pillY0 + pillY1) / 2),
      level: 0,
      sector: null,
      band: -1,
      lane: 0,
      sub: 0,
      role: "root",
      labelSlot: "ne",
      rank: 0,
    });
  }
  for (const p of plans) {
    for (const n of p.nodes.values()) {
      bandOf.set(n.id, p);
      const x = n.rail ? rnd(railX0 + n.sub * cfg.colPitch) : colX[n.level];
      let role: SubwayRole = n.rail ? "rail" : n.trunk ? "spine" : "branch";
      if (!n.rail && !n.parent && !n.leadIn) role = "island";
      let up = false;
      let down = false;
      for (const c of n.kids) {
        const cl = p.nodes.get(c)!.lane;
        if (cl < n.lane) up = true;
        else if (cl > n.lane) down = true;
      }
      const labelSlot: SubwayLabelSlot = up && !down ? "se" : "ne";
      pos.set(n.id, {
        id: n.id,
        x,
        y: laneY(p, n.lane),
        level: n.level,
        sector: p.topicId,
        band: p.index,
        lane: n.lane,
        sub: n.sub,
        role,
        labelSlot,
        rank: 0,
      });
    }
  }

  // ---- 6. aristas -------------------------------------------------------------------
  const P = (v: number) => rnd(v);
  const dedupe = (pts: Pt[]): Pt[] => {
    const out: Pt[] = [];
    for (const q of pts) {
      const l = out[out.length - 1];
      if (l && Math.abs(l[0] - q[0]) < EPS && Math.abs(l[1] - q[1]) < EPS) continue;
      out.push(q);
    }
    // quita vértices colineales
    const res: Pt[] = [];
    for (const q of out) {
      while (res.length >= 2) {
        const a = res[res.length - 2];
        const b = res[res.length - 1];
        const cr = (b[0] - a[0]) * (q[1] - b[1]) - (b[1] - a[1]) * (q[0] - b[0]);
        const dot = (b[0] - a[0]) * (q[0] - b[0]) + (b[1] - a[1]) * (q[1] - b[1]);
        if (Math.abs(cr) < EPS && dot > 0) res.pop();
        else break;
      }
      res.push(q);
    }
    return res;
  };
  const toPath = (pts: Pt[]): string => {
    const f = (q: Pt) => `${P(q[0])} ${P(q[1])}`;
    if (pts.length === 1) return `M${f(pts[0])}`;
    let d = `M${f(pts[0])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1];
      const v = pts[i];
      const b = pts[i + 1];
      const l1 = Math.hypot(v[0] - a[0], v[1] - a[1]);
      const l2 = Math.hypot(b[0] - v[0], b[1] - v[1]);
      const r = Math.min(cfg.trackCorner, l1 / 2, l2 / 2);
      const p1: Pt = [v[0] - ((v[0] - a[0]) / l1) * r, v[1] - ((v[1] - a[1]) / l1) * r];
      const p2: Pt = [v[0] + ((b[0] - v[0]) / l2) * r, v[1] + ((b[1] - v[1]) / l2) * r];
      d += `L${f(p1)}Q${f(v)} ${f(p2)}`;
    }
    return `${d}L${f(pts[pts.length - 1])}`;
  };
  const midOf = (pts: Pt[]) => {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let acc = total / 2;
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc <= len || i === pts.length - 1) {
        const t = len === 0 ? 0 : acc / len;
        return { x: P(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t), y: P(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t) };
      }
      acc -= len;
    }
    return { x: P(pts[0][0]), y: P(pts[0][1]) };
  };

  /** Segmentos 0/45/90 con la diagonal en el hueco de entrada de `zone`. */
  const treePts = (a: SubwayNode, b: SubwayNode, zone: number): Pt[] => {
    const dy = b.y - a.y;
    if (Math.abs(dy) < EPS) return [[a.x, a.y], [b.x, b.y]];
    const u = rnd(colX[zone] - fm);
    const start = rnd(u - Math.abs(dy));
    return [[a.x, a.y], [start, a.y], [u, b.y], [b.x, b.y]];
  };
  const chanCount = new Map<number, number>();
  const connectorPts = (a: SubwayNode, b: SubwayNode, viaZones?: number[]): Pt[] => {
    const dy = b.y - a.y;
    if (Math.abs(dy) < EPS) {
      const s = b.x >= a.x ? 1 : -1;
      const h = rnd(Math.min(pitch * 0.45, Math.abs(b.x - a.x) / 2));
      return [[a.x, a.y], [a.x + s * h, a.y - h], [b.x - s * h, a.y - h], [b.x, b.y]];
    }
    let bestZ = 1;
    let bestCost = Infinity;
    if (viaZones) {
      // Puente: el canal que deja menos estaciones bajo los tramos horizontales de los extremos.
      for (const z of viaZones) {
        const c = chanX(z, 0);
        let hits = 0;
        for (const n of pos.values()) {
          if (n === a || n === b) continue;
          if (Math.abs(n.y - a.y) < EPS && n.x > Math.min(a.x, c) && n.x < Math.max(a.x, c)) hits++;
          if (Math.abs(n.y - b.y) < EPS && n.x > Math.min(b.x, c) && n.x < Math.max(b.x, c)) hits++;
        }
        if (hits < bestCost) {
          bestCost = hits;
          bestZ = z;
        }
      }
    } else {
      for (let z = 1; z <= maxZone; z++) {
        const c = chanX(z, 0);
        const cost = Math.abs(a.x - c) + Math.abs(b.x - c);
        if (cost < bestCost - EPS) {
          bestCost = cost;
          bestZ = z;
        }
      }
    }
    const i = chanCount.get(bestZ) ?? 0;
    chanCount.set(bestZ, i + 1);
    const xc = chanX(bestZ, i);
    const sy = dy > 0 ? 1 : -1;
    const sxA = xc >= a.x ? 1 : -1;
    const sxB = b.x >= xc ? 1 : -1;
    // La diagonal no puede volver sobre la columna de la zona (pisaría a las estaciones vecinas).
    const dd = rnd(Math.min(Math.abs(dy) / 2, Math.abs(xc - a.x), Math.abs(b.x - xc), pitch * 1.5, xc - colX[bestZ] - cfg.nodeRadius - 2));
    return [
      [a.x, a.y],
      [rnd(xc - sxA * dd), a.y],
      [xc, rnd(a.y + sy * dd)],
      [xc, rnd(b.y - sy * dd)],
      [rnd(xc + sxB * dd), b.y],
      [b.x, b.y],
    ];
  };

  const bandPlanOf = new Map(plans.map((p) => [p.index, p]));
  /** y del carril `lane` de la banda de `a`. */
  const p0y = (a: SubwayNode, lane: number) => laneY(bandPlanOf.get(a.band)!, lane);
  /** Salida a 45° en el hueco de `z1`, tramo recto por `ym`, entrada a 45° en el hueco de `z2`. */
  const viaPts = (a: SubwayNode, b: SubwayNode, ym: number, z1: number, z2: number): Pt[] => {
    const u1 = rnd(colX[z1] - fm);
    const u2 = rnd(colX[z2] - fm);
    return [
      [a.x, a.y],
      [rnd(u1 - Math.abs(ym - a.y)), a.y],
      [u1, ym],
      [rnd(u2 - Math.abs(b.y - ym)), ym],
      [u2, b.y],
      [b.x, b.y],
    ];
  };

  const routeOf = new Map<string, Route>();
  for (const p of plans) {
    for (const r of p.routes) routeOf.set(`${r.from}>${r.to}`, r);
  }
  const edges: LayoutEdge[] = [];
  const edgeBand: (number | null)[] = [];
  const edgeSecondary: boolean[] = [];
  const pushEdge = (from: string, to: string, kind: LayoutEdgeKind, pts: Pt[], band: number | null, secondary: boolean, reason?: string) => {
    const clean = dedupe(pts.map((q) => [rnd(q[0]), rnd(q[1])] as Pt));
    edges.push({
      from,
      to,
      kind,
      path: toPath(clean),
      pts: clean,
      mid: midOf(clean),
      ...(reason ? { reason } : {}),
    });
    edgeBand.push(band);
    edgeSecondary.push(secondary);
  };
  const leadPts = (to: SubwayNode): Pt[] => [[0, to.y], [to.x, to.y]];

  for (const b of books) {
    const from = pos.get(b.id);
    if (!from) continue;
    for (const to of b.leadsTo ?? []) {
      const target = pos.get(to);
      if (!target) continue;
      if (b.level === 0) {
        pushEdge(b.id, to, "leadsTo", leadPts(target), target.band, false);
        continue;
      }
      const r = routeOf.get(`${b.id}>${to}`);
      if (r && from.band === target.band) {
        const pts = r.via !== undefined
          ? viaPts(from, target, p0y(from, r.via), r.forkZone, target.level)
          : r.bypass
          ? connectorPts(from, target, [...new Set([Math.max(1, target.level - 1), from.level])])
          : treePts(from, target, r.forkZone);
        pushEdge(b.id, to, "leadsTo", pts, from.band, r.secondary);
      } else {
        pushEdge(b.id, to, "leadsTo", connectorPts(from, target), null, false);
      }
    }
  }
  if (root) {
    for (const b of books) {
      if (b.level !== 1 || explicitFromRoot.has(b.id)) continue;
      const n = pos.get(b.id);
      if (n) pushEdge(root.id, b.id, "implicitRoot", leadPts(n), n.band, false);
    }
  }
  const seen = new Set<string>();
  for (const b of books) {
    const a = pos.get(b.id);
    if (!a) continue;
    for (const rel of b.related ?? []) {
      const c = pos.get(rel.id);
      if (!c || rel.id === b.id) continue;
      const kk = b.id < rel.id ? `${b.id}|${rel.id}` : `${rel.id}|${b.id}`;
      if (seen.has(kk)) continue;
      seen.add(kk);
      pushEdge(b.id, rel.id, "related", connectorPts(a, c), null, false, rel.reason);
    }
  }

  // ---- 7. cruces vía contra vía dentro de cada banda -------------------------------
  const crossings: SubwayCrossings = { tree: 0, secondary: 0 };
  const perBand = new Map<number, number[]>();
  edges.forEach((_, i) => {
    const bnd = edgeBand[i];
    if (bnd === null) return;
    (perBand.get(bnd) ?? perBand.set(bnd, []).get(bnd)!).push(i);
  });
  for (const idxs of perBand.values()) {
    for (let i = 0; i < idxs.length; i++) {
      for (let j = i + 1; j < idxs.length; j++) {
        const n = polylineCrossings(edges[idxs[i]].pts!, edges[idxs[j]].pts!);
        if (!n) continue;
        if (edgeSecondary[idxs[i]] || edgeSecondary[idxs[j]]) crossings.secondary += n;
        else crossings.tree += n;
      }
    }
  }

  // ---- 8. salida --------------------------------------------------------------------
  const nodes: SubwayNode[] = books.map((b) => pos.get(b.id)).filter((n): n is SubwayNode => !!n);
  const ranked = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x || cmp(a.id, b.id));
  ranked.forEach((n, i) => (n.rank = i));

  let minNodeDistance = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d < minNodeDistance) minNodeDistance = d;
    }
  }

  const zones: SubwayZone[] = [];
  for (let z = 1; z <= maxZone; z++) zones.push({ level: z, x: colX[z], x0: zoneRange[z][0], x1: zoneRange[z][1] });

  const bands: SubwayBand[] = plans.map((p) => {
    const xs = [...p.nodes.values()].map((n) => pos.get(n.id)!.x);
    return {
      topicId: p.topicId,
      index: p.index,
      y0: p.y0,
      y1: p.y1,
      spineY: p.spineY,
      startX: rnd(cfg.pillWidth / 2),
      endX: xs.length ? Math.max(...xs) : rnd(cfg.pillWidth / 2),
      entryId: p.entryId,
      count: p.nodes.size,
    };
  });

  const pad = 24;
  const minX = rnd(-(cfg.headerWidth + cfg.pillWidth / 2 + pad));
  const maxX = rnd(zoneRange[maxZone][1] + 72);
  const minY = rnd(-cfg.zoneHeaderHeight);
  const maxY = rnd((last ? last.y1 : 0) + pad);
  const bounds: LayoutBounds = { minX, minY, maxX, maxY, width: rnd(maxX - minX), height: rnd(maxY - minY) };

  return { nodes, edges, bands, zones, pill, bounds, minNodeDistance, crossings, config: cfg };
}

/** Cruces propios (interior contra interior, no paralelos) entre dos polilíneas. */
function polylineCrossings(a: readonly Pt[], b: readonly Pt[]): number {
  let n = 0;
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) if (segmentsCross(a[i - 1], a[i], b[j - 1], b[j])) n++;
  }
  return n;
}

function segmentsCross(p: Pt, q: Pt, r: Pt, s: Pt): boolean {
  const orient = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const o1 = orient(p, q, r);
  const o2 = orient(p, q, s);
  const o3 = orient(r, s, p);
  const o4 = orient(r, s, q);
  return o1 * o2 < -EPS && o3 * o4 < -EPS;
}
