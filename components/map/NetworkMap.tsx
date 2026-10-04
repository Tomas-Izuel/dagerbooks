"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type Ref,
} from "react";
import { useMapView } from "@/hooks/useMapView";
import { useGraphKeyboard } from "@/hooks/useGraphKeyboard";
import { lineColor } from "@/lib/design/lines";
import type { Selection } from "@/lib/state/explorer";
import type { LayoutEdge } from "@/lib/catalog/layout.types";
import type { NavNode } from "@/lib/graph-interaction";
import { DENSITY_SCALE, DEFAULT_DENSITY, type Density, type DensityScale } from "@/lib/density";
import { fitScale } from "@/lib/graph-interaction/viewport";
import type { Recommendation } from "@/lib/catalog/schema";
import { deriveRoute } from "@/lib/map/route";
import type { MapFocus, MapGeometry, MapHandle, MapLine, MapNode } from "./types";
import {
  HIT_PX,
  HIT_R,
  LABEL_CH,
  LABEL_LINE,
  LABEL_MIN_REL,
  LABEL_PX,
  WRAP_CHARS,
  aabb,
  boxesOverlap,
  clamp,
  deg,
  edgeKey,
  labelGap,
  truncate,
  wrapName,
  wrapTitle,
  type Box,
  type Tone,
} from "./shared/geometry";
import { FocusBar, HoverTag, MapLegend } from "./shared/MapOverlays";
import { InterchangeTags, TAG_MIN_SCALE, XTAG_H, buildXTags, quadraticMidpoint, type XTag } from "./shared/InterchangeTags";
import { Station, type CrossMark } from "./shared/Station";
import styles from "./NetworkMap.module.css";

/** Same handle for every map view (see `MapHandle`). */
export type NetworkMapHandle = MapHandle;

export interface NetworkMapProps {
  /** The whole network (every line), for the current density. */
  geometry: MapGeometry;
  /** A single line laid out on the whole circle (null = the whole network). */
  focus?: MapFocus | null;
  lines: readonly MapLine[];
  selection: Selection | null;
  /** Texto de cada nivel de recomendación (leyenda y etiquetas accesibles). */
  recLabels: Record<Recommendation, { label: string; description: string }>;
  /** Ids dimmed by the topic / recommendation filters (intersection). */
  dimmed: ReadonlySet<string>;
  /** The line in focus (same as `focus.topicId`). */
  activeTopic: string | null;
  read: ReadonlySet<string>;
  onSelect(id: string | null): void;
  /** Pone una línea en foco (null vuelve al mapa completo); el mismo estado que la cartelera. */
  onTopic(id: string | null): void;
  /** Px covered by overlays (side panel / bottom sheet). */
  insets?: { right?: number; bottom?: number };
  /** Animate the re-fit when `geometry` changes (density switch). Off = instant (first load). */
  animateRefit?: boolean;
  density?: Density;
  /** Px of the map covered by floating chrome (the view / density sign): the fit leaves it clear. */
  safe?: { top?: number; right?: number };
  ref?: Ref<MapHandle>;
}

const PAD_X = 290; // room beyond the terminus discs for their line names
const PAD_Y = 180;
/** Line names under the terminus discs: 11px Overpass caps, tracked; in screen px before sc.terminus. */
const NAME_PX = 11;
const NAME_CH = 7.9;
const NAME_LINE = 13;
const NAME_TOP = 22; // disc centre to the first line's centre
const TAU = Math.PI * 2;

const polar = (r: number, a: number) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });

/* ------------------------------------------------------------------ */
/* Static layers                                                       */
/* ------------------------------------------------------------------ */

function wedgePath(radius: number, start: number, end: number): string {
  const a = polar(radius, start);
  const b = polar(radius, end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M0 0L${a.x.toFixed(1)} ${a.y.toFixed(1)}A${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}Z`;
}

const Ground = memo(function Ground({
  geometry,
  activeTopic,
  focused,
}: {
  geometry: MapGeometry;
  activeTopic: string | null;
  focused: boolean;
}) {
  const { sectors, rings } = geometry;
  const outer = rings[rings.length - 1]?.radius ?? 0;
  // Short ticks in the outer band (outer ring to the terminus discs), in the middle of
  // each gap between sectors; subordinate to the lines. Skips the meridian (zone numerals).
  const dividers = sectors.slice(0, -1).map((s, i) => (s.endAngle + sectors[i + 1].startAngle) / 2);
  const last = sectors[sectors.length - 1];
  const first = sectors[0];
  const meridian = last && first ? (last.endAngle + first.startAngle + TAU) / 2 - TAU : -Math.PI / 2;
  return (
    <g aria-hidden="true">
      {sectors.map((s) =>
        activeTopic === s.topicId ? (
          <path
            key={`${s.topicId}:${focused ? "focus" : "sector"}`}
            className={styles.wedge}
            d={wedgePath(outer + 40, s.startAngle, s.endAngle)}
            style={{ "--ink": lineColor(s.topicId) } as CSSProperties}
          />
        ) : null,
      )}
      {dividers.map((a, i) => {
        const p0 = polar(outer + 6, a);
        const p1 = polar(outer + 44, a);
        return (
          <line
            key={i}
            className={styles.divider}
            x1={p0.x.toFixed(1)}
            y1={p0.y.toFixed(1)}
            x2={p1.x.toFixed(1)}
            y2={p1.y.toFixed(1)}
          />
        );
      })}
      {rings.map((r) => (
        <circle key={r.level} className={styles.zone} r={r.radius} />
      ))}
      {rings.map((r) => (
        <ZoneNumeral key={r.level} radius={r.radius} angle={meridian} level={r.level} />
      ))}
    </g>
  );
});

/** Counter-scaled by CSS (font-size: 11px / var(--k)) so it stays legible on screen at any zoom. */
function ZoneNumeral({ radius, angle, level }: { radius: number; angle: number; level: number }) {
  const p = polar(radius, angle);
  return (
    <text className={styles.zoneLabel} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} textAnchor="middle">
      {level}
    </text>
  );
}

/* ------------------------------------------------------------------ */
/* Labels (zoom-aware, counter-scaled)                                 */
/* ------------------------------------------------------------------ */

interface PlacedLabel {
  id: string;
  lines: string[];
  tone: Tone;
  pinned: boolean;
  left: boolean;
  rot: number;
  x: number;
  y: number;
}

/**
 * Greedy collision pass in screen space. Priority: selected > hovered >
 * prerequisite chain > unlocks > entry stations > the rest. A label whose box
 * overlaps one already placed (or KM 0 / a terminus disc / a station dot, for
 * the low priorities) is skipped. Only depends on the zoom, not the pan.
 */
function placeLabels({
  nodes,
  k,
  selection,
  hovered,
  topicActive,
  toneOf,
  reserved,
  xTags,
  kFit,
  sc,
}: {
  nodes: readonly MapNode[];
  k: number;
  kFit: number;
  sc: DensityScale;
  selection: Selection | null;
  hovered: string | null;
  topicActive: boolean;
  toneOf(id: string): Tone;
  reserved: readonly Box[];
  xTags: readonly XTag[];
}): { labels: PlacedLabel[]; tags: XTag[] } {
  interface Cand {
    n: MapNode;
    tone: Tone;
    prio: number;
    pinned: boolean;
    lines: string[];
  }
  const m = sc.mark;
  const rel = k / kFit;
  const ls = m * clamp(rel, 1, sc.maxGrow); // label scale on screen
  const maxChars = (level: number) => (level >= 4 ? 30 : clamp(Math.floor((175 * k - 36) / 7.6), 14, 30));
  const cands: Cand[] = [];
  for (const n of nodes) {
    if (n.level === 0) continue;
    const tone = toneOf(n.id);
    let prio = 5;
    if (selection?.id === n.id) prio = 0;
    else if (hovered === n.id) prio = 1;
    else if (selection?.prerequisites.has(n.id)) prio = 2;
    else if (selection?.unlocks.has(n.id)) prio = 3;
    else if (n.entry && tone !== "dim" && rel >= sc.entryAt) prio = 4;
    else {
      const threshold = (LABEL_MIN_REL[n.level] ?? 2) * sc.labelMul * (topicActive && tone === "full" ? 0.5 : 1);
      if (tone === "dim" || rel < threshold) continue;
    }
    // In focus the line has the whole circle: wrap every title instead of truncating it.
    const wrapped = prio <= 4 || topicActive;
    const lines = wrapped ? wrapTitle(n.title, WRAP_CHARS, 2) : [truncate(n.title, maxChars(n.level))];
    cands.push({ n, tone, prio, pinned: prio <= 2, lines });
  }
  cands.sort((a, b) => a.prio - b.prio || a.n.level - b.n.level || (a.n.id < b.n.id ? -1 : 1));

  const tagScale = Math.max(ls, TAG_MIN_SCALE);
  const placed: Box[] = [];
  const out: PlacedLabel[] = [];
  const outTags: XTag[] = [];
  let tagsDone = false;
  // Interchange tags rank just below the selected station's label.
  const placeTags = () => {
    tagsDone = true;
    for (const t of xTags) {
      const box = aabb(t.x * k, t.y * k, (t.w * tagScale) / 2, (XTAG_H * tagScale) / 2);
      if (reserved.some((r) => boxesOverlap(box, r, 3)) || placed.some((p) => boxesOverlap(box, p, 3))) continue;
      placed.push(box);
      outTags.push(t);
    }
  };
  for (const c of cands) {
    if (!tagsDone && c.prio > 0) placeTags();
    const { n } = c;
    const left = Math.cos(n.angle) < 0;
    const rot = n.angle + (left ? Math.PI : 0);
    const ux = Math.cos(rot);
    const uy = Math.sin(rot);
    const w = (Math.max(...c.lines.map((l) => l.length)) * LABEL_CH + 4) * ls;
    const h = (c.lines.length * LABEL_LINE + 2) * ls;
    const gap = labelGap(ls, m, k);
    const lx = (left ? -1 : 1) * (gap + w / 2);
    const ly = -6 * ls - ((c.lines.length - 1) * LABEL_LINE * ls) / 2;
    const sx = n.x * k;
    const sy = n.y * k;
    const box: Box = { cx: sx + lx * ux - ly * uy, cy: sy + lx * uy + ly * ux, ux, uy, hw: w / 2, hh: h / 2 };
    let hit = reserved.some((r) => boxesOverlap(box, r, 3)) || placed.some((p) => boxesOverlap(box, p, 3));
    if (!hit && (c.prio === 3 || c.prio === 5)) {
      hit = nodes.some(
        (o) => o.id !== n.id && o.level !== 0 && boxesOverlap(box, aabb(o.x * k, o.y * k, 9 * m, 9 * m), 0),
      );
    }
    if (hit) continue;
    placed.push(box);
    out.push({ id: n.id, lines: c.lines, tone: c.tone, pinned: c.pinned, left, rot: deg(rot), x: n.x, y: n.y });
  }
  if (!tagsDone) placeTags();
  return { labels: out, tags: outTags };
}

function StationLabels({
  labels,
  k,
  ls,
  m,
}: {
  labels: readonly PlacedLabel[];
  k: number;
  ls: number;
  m: number;
}) {
  const fs = (LABEL_PX * ls) / k;
  const lh = (LABEL_LINE * ls) / k;
  const gap = labelGap(ls, m, k) / k;
  return (
    <g aria-hidden="true">
      {labels.map((l) => {
        const x = (l.left ? -1 : 1) * gap;
        const y0 = -((6 * ls) / k) - ((l.lines.length - 1) * lh) / 2;
        return (
          <text
            key={l.id}
            className={styles.label}
            data-tone={l.tone}
            data-pinned={l.pinned ? "true" : undefined}
            transform={`translate(${l.x} ${l.y}) rotate(${l.rot.toFixed(1)})`}
            x={x}
            y={y0}
            textAnchor={l.left ? "end" : "start"}
            fontSize={fs}
            strokeWidth={(4 * ls) / k}
          >
            {l.lines.map((line, i) => (
              <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

export function NetworkMap({
  geometry,
  focus = null,
  lines,
  selection,
  recLabels,
  dimmed,
  activeTopic,
  read,
  onSelect,
  onTopic,
  insets,
  animateRefit = false,
  density = DEFAULT_DENSITY,
  safe,
  ref,
}: NetworkMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  // `geometry` is the whole network; `view` is what is in play now (the focused line, or everything).
  // Stations keep a slot in both so they can glide between the two layouts.
  const view = focus?.geometry ?? geometry;
  const { nodes, edges, bounds } = view;
  const focusKey = focus?.topicId ?? null;
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const fullById = useMemo(() => new Map(geometry.nodes.map((n) => [n.id, n])), [geometry.nodes]);
  const lineByTopic = useMemo(() => new Map(lines.map((l) => [l.topicId, l])), [lines]);
  const rootNode = useMemo(() => nodes.find((n) => n.level === 0) ?? null, [nodes]);
  const selectedId = selection?.id ?? null;

  const panBounds = useMemo(
    () => ({ x0: bounds.minX - PAD_X, y0: bounds.minY - PAD_Y, x1: bounds.maxX + PAD_X, y1: bounds.maxY + PAD_Y }),
    [bounds],
  );
  const { svgRef, gRef, pan } = useMapView({
    panBounds,
    nodeById,
    geometry,
    selectedId,
    insets,
    animateRefit,
    handleRef: ref,
    // Only the right side: on a phone the circle already sits under the sign.
    reserve: { right: safe?.right },
  });
  const { transform: tf } = pan;

  const navNodes = useMemo<NavNode[]>(() => nodes.map((n) => ({ id: n.id, angle: n.angle, ring: n.level })), [nodes]);
  const getPosition = useCallback((id: string) => nodeById.get(id), [nodeById]);
  // Escape peels one layer: the open station first, then the line in focus.
  const onClear = useCallback(() => {
    if (selectedId) onSelect(null);
    else if (focusKey) onTopic(null);
  }, [selectedId, focusKey, onSelect, onTopic]);
  const kb = useGraphKeyboard({
    nodes: navNodes,
    containerRef: svgRef,
    selectedId,
    onSelect,
    onClear,
    getPosition,
    transform: tf,
    getViewportSize: pan.getViewportSize,
    centerOn: pan.centerOn,
    zoomIn: pan.zoomIn,
    zoomOut: pan.zoomOut,
    reset: pan.reset,
    insets,
  });

  const kbRef = useRef(kb);
  useEffect(() => {
    kbRef.current = kb;
  });
  const onFocusId = useCallback((id: string, e: FocusEvent<Element>) => kbRef.current.getNodeProps(id).onFocus(e), []);

  // Entering, leaving or switching the focus: back to the fitted view (the bounds are the same
  // in every layout, only what fills them changes).
  const { fitToBounds } = pan;
  const prevFocusKey = useRef(focusKey);
  useEffect(() => {
    if (prevFocusKey.current === focusKey) return;
    prevFocusKey.current = focusKey;
    fitToBounds(0, false);
  }, [focusKey, fitToBounds]);

  // `morph` is on only while the focus changes: transitions apply then and never on a density switch.
  // Derived during render so the first frame of the new layout already carries it.
  const [seenFocus, setSeenFocus] = useState(focusKey);
  const [morph, setMorph] = useState(false);
  const [announce, setAnnounce] = useState("");
  if (seenFocus !== focusKey) {
    setSeenFocus(focusKey);
    setMorph(true);
    const l = focusKey ? lines.find((x) => x.topicId === focusKey) : undefined;
    setAnnounce(focus && l ? `Línea ${l.letter}: ${focus.count} estaciones` : "Mapa completo");
  }
  useEffect(() => {
    if (!morph) return;
    const t = setTimeout(() => setMorph(false), 1200);
    return () => clearTimeout(t);
  }, [morph, focusKey]);
  // The track layer of the line stays mounted (hidden) after leaving, so it can fade out like it faded in.
  const [lastFocus, setLastFocus] = useState(focus);
  if (focus && focus !== lastFocus) setLastFocus(focus);
  const focusLayer = focus ?? lastFocus;

  /* ---- tones ---- */
  const toneOfNode = useCallback(
    (id: string): Tone => {
      if (selection) {
        if (id === selection.id || selection.prerequisites.has(id)) return "full";
        if (selection.unlocks.has(id)) return "mid";
        return "dim";
      }
      return dimmed.has(id) ? "dim" : "full";
    },
    [selection, dimmed],
  );

  /* ---- route (train run) + unlock edges ---- */
  const route = useMemo(() => (selection ? deriveRoute(edges, selection, rootNode?.id) : null), [selection, edges, rootNode]);

  const edgeTone = useCallback(
    (e: LayoutEdge): Tone => {
      if (selection) {
        const key = edgeKey(e);
        if (route?.runKeys.has(key)) return "dim"; // the animated overlay carries the ink
        if (route?.unlock.has(key)) return "mid";
        return "dim";
      }
      return dimmed.has(e.to) || dimmed.has(e.from) ? "dim" : "full";
    },
    [selection, route, dimmed],
  );

  const targetInk = useCallback(
    (e: LayoutEdge, byId: ReadonlyMap<string, MapNode>) =>
      lineColor(byId.get(e.to)?.topicId ?? byId.get(e.from)?.topicId),
    [],
  );

  /** Main trunk = the first leg of every line (KM 0 and zone 1 outward); deeper legs are drawn lighter at rest. */
  const isTrunk = useCallback(
    (e: LayoutEdge, byId: ReadonlyMap<string, MapNode>) => (byId.get(e.from)?.level ?? 0) <= 1,
    [],
  );
  /** Implicit KM 0 spokes: hidden at rest, shown for the selected route or the active line. */
  const showSpoke = useCallback(
    (e: LayoutEdge, byId: ReadonlyMap<string, MapNode>) => {
      if (selection) return route?.runKeys.has(edgeKey(e)) ?? false;
      return !!activeTopic && byId.get(e.to)?.topicId === activeTopic;
    },
    [selection, route, activeTopic],
  );

  /* ---- interchanges (related) ---- */
  const focusIds = useMemo(() => new Set([hovered, selectedId].filter((v): v is string => !!v)), [hovered, selectedId]);
  const relatedActive = useMemo(() => {
    const keys = new Set<string>();
    const ends = new Set<string>();
    for (const e of edges) {
      if (e.kind !== "related") continue;
      if (focusIds.has(e.from) || focusIds.has(e.to)) {
        keys.add(edgeKey(e));
        ends.add(e.from);
        ends.add(e.to);
      }
    }
    return { keys, ends };
  }, [edges, focusIds]);

  const pickNode = useCallback((id: string) => onSelect(id), [onSelect]);

  // Lookup for the line's layer while it fades out after leaving the focus.
  const lastById = useMemo(() => new Map((focusLayer?.geometry.nodes ?? []).map((n) => [n.id, n])), [focusLayer]);
  const renderTrack = (e: LayoutEdge, byId: ReadonlyMap<string, MapNode>) => {
    if (e.kind === "related") return null;
    if (e.kind === "implicitRoot" && !showSpoke(e, byId)) return null;
    return (
      <path
        key={edgeKey(e)}
        className={styles.track}
        data-kind={e.kind}
        data-tone={edgeTone(e)}
        data-trunk={isTrunk(e, byId) ? "true" : "false"}
        d={e.path}
        style={{ "--ink": targetInk(e, byId) } as CSSProperties}
      />
    );
  };

  /* ---- combinations with other lines (focus mode): a disc per line on the station, not a track ---- */
  const crossMarks = useMemo(() => {
    const out = new Map<string, CrossMark[]>();
    if (!focus) return out;
    for (const [id, topics] of focus.links) {
      const marks = topics
        .map((t) => lineByTopic.get(t))
        .filter((l): l is MapLine => !!l)
        .sort((a, b) => a.letter.localeCompare(b.letter))
        .map((l) => ({ letter: l.letter, color: l.color }));
      if (marks.length) out.set(id, marks);
    }
    return out;
  }, [focus, lineByTopic]);

  const k = tf.k;
  const sc = DENSITY_SCALE[density];
  const m = sc.mark;
  // Zoom at which the active layout fits the viewport; label sizes and thresholds hang from it.
  const vp = pan.getViewportSize();
  const kFit = vp.width > 0 ? Math.min(fitScale(panBounds, vp), k) : k;
  const ls = m * clamp(k / kFit, 1, sc.maxGrow);
  const tagScale = Math.max(ls, TAG_MIN_SCALE);
  const hitR = Math.max(HIT_R, HIT_PX / k);
  const outer = view.rings[view.rings.length - 1]?.radius ?? 0;

  /* ---- line names under the terminus discs ---- */
  const lineNames = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const l of lines) out.set(l.topicId, wrapName(l.name));
    return out;
  }, [lines]);

  /* Names that would overlap an earlier one (active line first) hide at rest and show on hover/focus. */
  const nameShown = useMemo(() => {
    const shown = new Set<string>();
    const placedNames: Box[] = [];
    const order = [...view.sectors].sort((a, b) => Number(b.topicId === activeTopic) - Number(a.topicId === activeTopic));
    for (const s of order) {
      const nm = lineNames.get(s.topicId);
      if (!nm) continue;
      const p = polar(outer + 66, s.labelAngle);
      const w = Math.max(...nm.map((l) => l.length)) * NAME_CH + 8;
      const h = nm.length * NAME_LINE + 6;
      const box = aabb(p.x * k, p.y * k + (NAME_TOP - NAME_LINE / 2 + h / 2) * sc.terminus, (w / 2) * sc.terminus, (h / 2) * sc.terminus);
      const discs = view.sectors.some((o) => {
        if (o.topicId === s.topicId) return false;
        const q = polar(outer + 66, o.labelAngle);
        return boxesOverlap(box, aabb(q.x * k, q.y * k, 16 * sc.terminus, 16 * sc.terminus), 2);
      });
      // At the fit zoom the map is centred: a name wider than the viewport would be cut off.
      const clipped = vp.width > 0 && k <= kFit * 1.01 && Math.abs(box.cx) + box.hw > vp.width / 2;
      if (discs || clipped || placedNames.some((b) => boxesOverlap(box, b, 2))) continue;
      placedNames.push(box);
      shown.add(s.topicId);
    }
    return shown;
  }, [view.sectors, lineNames, activeTopic, outer, k, kFit, vp.width, sc.terminus]);

  /* ---- labels: greedy collision pass (screen space) ---- */
  const reserved = useMemo<Box[]>(() => {
    const boxes: Box[] = [
      // Km 0 disc and its label (the label is 12px type, ~9px per glyph, tracked).
      aabb(0, 0, 24 * m * k + 6, 24 * m * k + 6),
      aabb(0, 34 * m * k + 12 * ls, ((23 * 9.2) / 2 + 4) * ls, 10 * ls),
    ];
    for (const s of view.sectors) {
      const p = polar(outer + 66, s.labelAngle);
      boxes.push(aabb(p.x * k, p.y * k, 20 * sc.terminus, 20 * sc.terminus));
      const nm = nameShown.has(s.topicId) ? lineNames.get(s.topicId) : undefined;
      if (nm) {
        const w = Math.max(...nm.map((l) => l.length)) * NAME_CH + 8;
        const h = nm.length * NAME_LINE + 6;
        boxes.push(aabb(p.x * k, p.y * k + (NAME_TOP - NAME_LINE / 2 + h / 2) * sc.terminus, (w / 2) * sc.terminus, (h / 2) * sc.terminus));
      }
    }
    return boxes;
  }, [view.sectors, outer, k, m, ls, sc.terminus, nameShown, lineNames]);
  // Tags: the hovered station's interchanges on hover, otherwise all of the selected station's.
  const tagFocus = hovered ?? selectedId;
  const xTagCands = useMemo<XTag[]>(
    () => buildXTags(edges, tagFocus, (e) => quadraticMidpoint(e.path)),
    [edges, tagFocus],
  );
  const { labels, tags } = useMemo(
    () =>
      placeLabels({
        nodes,
        k,
        kFit,
        sc,
        selection,
        hovered,
        topicActive: !!activeTopic,
        toneOf: toneOfNode,
        reserved,
        xTags: xTagCands,
      }),
    [nodes, k, kFit, sc, selection, hovered, activeTopic, toneOfNode, reserved, xTagCands],
  );
  const hoveredNode = hovered ? nodeById.get(hovered) : undefined;
  const hoveredLine = hoveredNode ? lineByTopic.get(hoveredNode.topicId ?? "") : undefined;
  const hoveredCross = hovered ? crossMarks.get(hovered) : undefined;
  const focusLine = focusKey ? lineByTopic.get(focusKey) : undefined;

  return (
    <div
      className={styles.map}
      data-morph={morph ? "true" : undefined}
      data-focus={focusKey ?? undefined}
      style={{ "--k": k, "--m": m, "--ts": tagScale } as CSSProperties}
    >
      <svg
        ref={svgRef}
        className={styles.svg}
        role="group"
        aria-label="Mapa de lecturas"
        aria-describedby="map-help"
        {...kb.containerProps}
      >
        <g ref={gRef}>
          <rect
            className={styles.backdrop}
            x={panBounds.x0}
            y={panBounds.y0}
            width={panBounds.x1 - panBounds.x0}
            height={panBounds.y1 - panBounds.y0}
            onClick={() => selectedId && onSelect(null)}
          />
          <Ground geometry={view} activeTopic={activeTopic} focused={!!focus} />

          {/* Tracks: the whole network, and the line's own layout; one fades out as the other fades in */}
          <g className={styles.layer} data-on={focus ? "false" : "true"} aria-hidden="true">
            {geometry.edges.map((e) => renderTrack(e, fullById))}
          </g>
          {focusLayer ? (
            <g
              key={focusLayer.topicId}
              className={styles.layer}
              data-on={focus ? "true" : "false"}
              aria-hidden="true"
            >
              {focusLayer.geometry.edges.map((e) => renderTrack(e, focus ? nodeById : lastById))}
            </g>
          ) : null}

          {/* Interchanges */}
          <g aria-hidden="true">
            {edges.map((e) =>
              e.kind === "related" && relatedActive.keys.has(edgeKey(e)) ? (
                <g key={edgeKey(e)} className={styles.related}>
                  <path className={styles.relatedOuter} d={e.path} />
                  <path className={styles.relatedInner} d={e.path} />
                </g>
              ) : null,
            )}
          </g>

          {/* The train run: prerequisites drawn from KM 0, segment by segment */}
          {route ? (
            <g key={selection?.id} aria-hidden="true">
              {route.run.map(({ edge, index }) => (
                <path
                  key={edgeKey(edge)}
                  className={styles.run}
                  d={edge.path}
                  pathLength={1}
                  style={{ "--ink": targetInk(edge, nodeById), "--i": index, "--n": route.n } as CSSProperties}
                />
              ))}
            </g>
          ) : null}

          {/* Stations: every one keeps a slot; the ones outside the line in focus fade out where they are */}
          <g>
            {geometry.nodes.map((full) => {
              const focused = focus ? nodeById.get(full.id) : undefined;
              const n = focused ?? full;
              const out = !!focus && !focused;
              const line = n.topicId ? lineByTopic.get(n.topicId) : undefined;
              const isRead = read.has(n.id);
              const np = kb.getNodeProps(n.id);
              const cross = crossMarks.get(n.id);
              const combines = cross?.length ? `combina con ${cross.length > 1 ? "las líneas" : "la línea"} ${cross.map((c) => c.letter).join(" y ")}` : null;
              const status = [recLabels[n.recommendation].label, isRead ? "leído" : null, n.incomplete ? "por completar" : null, combines].filter(Boolean).join(", ");
              const label =
                n.level === 0
                  ? `${n.title}, kilómetro 0${isRead ? ", leído" : ""}`
                  : `${n.title}, línea ${line?.letter ?? "?"}, zona ${n.level}${status ? `, ${status}` : ""}`;
              return (
                <Station
                  key={n.id}
                  node={n}
                  color={line?.color ?? "var(--fg)"}
                  tone={toneOfNode(n.id)}
                  out={out}
                  cross={cross}
                  read={isRead}
                  selected={np["aria-pressed"]}
                  interchange={relatedActive.ends.has(n.id)}
                  m={m}
                  hitR={hitR}
                  tabIndex={np.tabIndex}
                  ariaLabel={label}
                  onPick={pickNode}
                  onHover={setHovered}
                  onFocusId={onFocusId}
                />
              );
            })}
          </g>

          {/* Keyed by mode: the labels of a new layout fade in once the stations have arrived. */}
          <g key={focusKey ?? "all"} className={styles.late}>
            <StationLabels labels={labels} k={k} ls={ls} m={m} />
            <InterchangeTags tags={tags} k={k} scale={tagScale} />
          </g>

          {rootNode ? (
            <text
              className={styles.rootLabel}
              aria-hidden="true"
              x={0}
              y={34 * m + (12 * ls) / k}
              textAnchor="middle"
              fontSize={(12 * ls) / k}
              strokeWidth={(5 * ls) / k}
            >
              KM 0 · TOM SAWYER ABROAD
            </text>
          ) : null}

          {/* Line termini: lettered discs at the end of each sector, with the line name below. Click = put the line in focus (again = back to the map). */}
          <g>
            {geometry.sectors.map((full) => {
              const line = lineByTopic.get(full.topicId);
              if (!line) return null;
              // In focus the line's disc moves to its place on the full circle; the others fade out where they are.
              const s = focus ? (focus.topicId === full.topicId ? view.sectors[0] : undefined) : full;
              const out = !s;
              const at = s ?? full;
              const p = polar(outer + 66, at.labelAngle);
              const active = activeTopic === full.topicId;
              const nm = lineNames.get(full.topicId) ?? [];
              const w = Math.max(...nm.map((l) => l.length), 2) * NAME_CH + 14;
              const h = NAME_TOP + nm.length * NAME_LINE;
              return (
                <g
                  key={full.topicId}
                  className={styles.terminus}
                  data-out={out ? "true" : undefined}
                  data-active={active ? "true" : undefined}
                  data-name={nameShown.has(full.topicId) ? "shown" : "hidden"}
                  role="button"
                  tabIndex={out ? -1 : 0}
                  aria-pressed={active}
                  aria-hidden={out ? true : undefined}
                  aria-label={active ? `Salir de la línea ${line.letter}: ${line.name}` : `Ver solo la línea ${line.letter}: ${line.name}`}
                  style={{ "--ink": line.color, transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)` } as CSSProperties}
                  onClick={() => onTopic(active ? null : full.topicId)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTopic(active ? null : full.topicId);
                    }
                  }}
                >
                  <g transform={`scale(${(sc.terminus / k).toFixed(4)})`}>
                    <rect className={styles.terminusHit} x={-w / 2} y={-19} width={w} height={h + 4} rx={4} />
                    <circle r={15} className={styles.terminusDisc} />
                    <text className={styles.terminusLetter} y={1}>
                      {line.letter}
                    </text>
                    <text className={styles.terminusName} aria-hidden="true" fontSize={NAME_PX}>
                      {nm.map((l, i) => (
                        <tspan key={i} x={0} y={NAME_TOP + i * NAME_LINE}>
                          {l}
                        </tspan>
                      ))}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </p>

      {focus && focusLine ? (
        <FocusBar line={focusLine} count={focus.count} parked={!!insets?.right} onExit={() => onTopic(null)} />
      ) : null}

      <p id="map-help" className={styles.srOnly}>
        Usá las flechas para moverte entre estaciones: arriba hacia afuera, abajo hacia el centro, izquierda y derecha
        a lo largo de la zona. Enter abre la estación, Escape la cierra, más y menos acercan y alejan.
      </p>

      <MapLegend recLabels={recLabels} insetRight={insets?.right} />

      {hoveredNode ? (
        <HoverTag
          title={hoveredNode.title}
          titleEs={hoveredNode.titleEs}
          level={hoveredNode.level}
          line={hoveredLine}
          cross={hoveredCross}
          left={tf.x + hoveredNode.x * k}
          top={tf.y + hoveredNode.y * k}
        />
      ) : null}
    </div>
  );
}
