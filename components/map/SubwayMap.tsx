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
import type { PanZoomApi } from "@/hooks/usePanZoom";
import { lineColor } from "@/lib/design/lines";
import type { ExplorerNode, Selection } from "@/lib/state/explorer";
import type { LayoutEdge } from "@/lib/catalog/layout.types";
import type { NavNode } from "@/lib/graph-interaction";
import { DENSITY_SCALE, DEFAULT_DENSITY, type Density } from "@/lib/density";
import { fitScale } from "@/lib/graph-interaction/viewport";
import type { Recommendation } from "@/lib/catalog/schema";
import { deriveRoute } from "@/lib/map/route";
import { ZONE_NAMES, type MapGeometrySet, type MapHandle, type MapLine } from "./types";
import {
  HIT_PX,
  HIT_R,
  LABEL_LINE,
  LABEL_PX,
  aabb,
  clamp,
  edgeKey,
  wrapName,
  type Box,
  type Tone,
} from "./shared/geometry";
import { FocusBar, HoverTag, MapLegend } from "./shared/MapOverlays";
import { InterchangeTags, TAG_MIN_SCALE, buildXTags, type XTag } from "./shared/InterchangeTags";
import { Station, type CrossMark } from "./shared/Station";
import { placeSubwayLabels, type PlacedSubwayLabel, type Segment } from "./subway/labels";
import type { SubwayFocus, SubwayGeometry, SubwayMapNode } from "./subway/types";
import { resolveSubway, resolveSubwayFocus } from "./subway/resolve";
import base from "./NetworkMap.module.css";
import styles from "./SubwayMap.module.css";

export type { MapHandle };

export interface SubwayMapProps {
  /** Station and edge metadata (the radial positions in it are ignored: the subway lays itself out). */
  set: MapGeometrySet;
  explorerNodes: readonly ExplorerNode[];
  lines: readonly MapLine[];
  density?: Density;
  /** The line in focus (null = the whole network). */
  activeTopic: string | null;
  selection: Selection | null;
  /** Texto de cada nivel de recomendación (leyenda y etiquetas accesibles). */
  recLabels: Record<Recommendation, { label: string; description: string }>;
  /** Ids dimmed by the topic / recommendation filters (intersection). */
  dimmed: ReadonlySet<string>;
  read: ReadonlySet<string>;
  onSelect(id: string | null): void;
  /** Pone una línea en foco (null vuelve al mapa completo); el mismo estado que la cartelera. */
  onTopic(id: string | null): void;
  /** Px covered by overlays (side panel / bottom sheet). */
  insets?: { right?: number; bottom?: number };
  /** Animate the re-fit when the density changes. Off = instant (first load). */
  animateRefit?: boolean;
  /** Px of the map covered by floating chrome (the view / density sign): the home framing leaves `top` clear. */
  safe?: { top?: number; right?: number };
  ref?: Ref<MapHandle>;
}

const PAD = 24;
/** Below this viewport width the map is framed for a phone (see `frameOf`). */
const NARROW_PX = 700;
/** Reading zoom of a single line on a phone. */
const FOCUS_NARROW_K = 0.85;
const MAX_ZOOM = 3;
const NAME_PX = 11;
const NAME_CH = 7.9;
const NAME_LINE = 13;
const DISC_R = 15;
/** Screen px from the pill edge to the header disc centre / from the band end to the end disc centre. */
const HEAD_GAP = 24;
const END_GAP = 24;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Framing                                                             */
/* ------------------------------------------------------------------ */

interface Frame {
  /** Zoom of the home framing (also the reference the label thresholds hang from). */
  k: number;
  /** World point at the top-left of the viewport, or null = centre the bounds (contain). */
  topLeft: { x: number; y: number } | null;
}

/**
 * Home framing. Desktop: a tall map is framed by its width, anchored at the top-left (Km 0 and line A);
 * the rest is read by scrolling. Phones: the width of zones 1 and 2, anchored on Km 0; a single line
 * opens at a reading zoom. A single line on desktop just fits.
 */
function frameOf(view: SubwayGeometry, panBounds: Bounds4, vw: number, vh: number, focused: boolean, safeTop = 0, safeRight = 0): Frame {
  const narrow = vw < NARROW_PX;
  const contain = fitScale(panBounds, { width: vw, height: vh });
  if (focused && !narrow) return { k: contain, topLeft: null };
  const first = view.bands[0];
  if (narrow) {
    const z2 = view.zones[Math.min(1, view.zones.length - 1)];
    const span = z2 ? z2.x1 - view.pill.x : panBounds.x1 - panBounds.x0;
    const k = focused ? FOCUS_NARROW_K : Math.max((vw - 76) / Math.max(span, 1), contain);
    // Under the sign (and, in focus, the focus bar) and the zone strip, both HTML over the top of the stage.
    const top = safeTop + 30 + (focused ? 56 : 0) + 24;
    return { k, topLeft: { x: view.pill.x - 60 / k, y: (first?.y0 ?? panBounds.y0) - top / k } };
  }
  // Desktop: the width left of the sign, so no band end sits under it.
  const k = Math.max(Math.max(vw - safeRight, 1) / (panBounds.x1 - panBounds.x0), contain);
  return { k, topLeft: { x: panBounds.x0, y: panBounds.y0 } };
}

interface Bounds4 {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/* ------------------------------------------------------------------ */
/* Static layers                                                       */
/* ------------------------------------------------------------------ */

/** Band tints and the dotted zone columns: the ground the stations stand on. */
const Ground = memo(function Ground({
  geometry,
  activeTopic,
}: {
  geometry: SubwayGeometry;
  activeTopic: string | null;
}) {
  const { bands, zones, bounds } = geometry;
  const gap = bands.length > 1 ? bands[1].y0 - bands[0].y1 : 0;
  return (
    <g aria-hidden="true">
      {bands.map((b) => (
        <rect
          key={b.topicId}
          className={styles.band}
          data-alt={b.index % 2 === 1 ? "true" : undefined}
          data-active={activeTopic === b.topicId ? "true" : undefined}
          x={bounds.minX}
          y={b.y0 - gap / 2}
          width={bounds.maxX - bounds.minX}
          height={b.y1 - b.y0 + gap}
          style={{ "--ink": lineColor(b.topicId) } as CSSProperties}
        />
      ))}
      {zones.map((z) => (
        <line
          key={z.level}
          className={styles.zoneLine}
          x1={z.x0}
          x2={z.x0}
          y1={bounds.minY + 8}
          y2={bounds.maxY}
        />
      ))}
    </g>
  );
});

/** Km 0 as a long station: a capsule from the first band to the last (a circle when it spans a single lane). */
function RootPill({
  node,
  pill,
  m,
  tone,
  read,
  selected,
  tabIndex,
  ariaLabel,
  onPick,
  onHover,
  onFocusId,
}: {
  node: SubwayMapNode;
  pill: SubwayGeometry["pill"];
  m: number;
  tone: Tone;
  read: boolean;
  selected: boolean;
  tabIndex: 0 | -1;
  ariaLabel: string;
  onPick(id: string): void;
  onHover(id: string | null): void;
  onFocusId(id: string, e: FocusEvent<Element>): void;
}) {
  const w = pill.width * m;
  const wi = w * 0.5;
  const top = pill.y0 - node.y - w / 2;
  const h = pill.y1 - pill.y0 + w;
  return (
    <g
      className={base.station}
      data-id={node.id}
      data-tone={tone}
      data-read={read ? "true" : undefined}
      data-root="true"
      role="button"
      tabIndex={tabIndex}
      aria-pressed={selected}
      aria-label={ariaLabel}
      style={{ "--ink": "var(--fg)", transform: `translate(${node.x}px, ${node.y}px)` } as CSSProperties}
      onClick={() => onPick(node.id)}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={(e) => {
        onFocusId(node.id, e);
        onHover(node.id);
      }}
      onBlur={() => onHover(null)}
    >
      <rect className={base.hit} x={-w} y={top - w / 4} width={2 * w} height={h + w / 2} rx={w} />
      <rect className={base.focusRing} x={-w / 2 - 6} y={top - 6} width={w + 12} height={h + 12} rx={w / 2 + 6} />
      <rect className={base.rootOuter} x={-w / 2} y={top} width={w} height={h} rx={w / 2} />
      <rect className={base.rootInner} x={-wi / 2} y={top + (w - wi) / 2} width={wi} height={h - (w - wi)} rx={wi / 2} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

function StationLabels({ labels, k, ls }: { labels: readonly PlacedSubwayLabel[]; k: number; ls: number }) {
  const fs = (LABEL_PX * ls) / k;
  const lh = (LABEL_LINE * ls) / k;
  return (
    <g aria-hidden="true">
      {labels.map((l) => {
        const east = l.slot === "ne" || l.slot === "se";
        const x = l.ax / k;
        const y0 = l.cy / k - ((l.lines.length - 1) * lh) / 2;
        return (
          <text
            key={l.id}
            className={base.label}
            data-tone={l.tone}
            data-pinned={l.pinned ? "true" : undefined}
            transform={`translate(${l.x} ${l.y})`}
            x={x}
            y={y0}
            textAnchor={east ? "start" : "end"}
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

export function SubwayMap({
  set,
  explorerNodes,
  lines,
  density = DEFAULT_DENSITY,
  activeTopic,
  selection,
  recLabels,
  dimmed,
  read,
  onSelect,
  onTopic,
  insets,
  animateRefit = false,
  safe,
  ref,
}: SubwayMapProps) {
  const safeTop = safe?.top ?? 0;
  const safeRight = safe?.right ?? 0;
  const [hovered, setHovered] = useState<string | null>(null);

  // `full` is the whole network; `view` is what is in play now (one line in focus, or everything).
  // Stations keep a slot in both so they can glide between the two layouts.
  const topicIds = useMemo(() => lines.map((l) => l.topicId), [lines]);
  const full = useMemo(() => resolveSubway(set, topicIds, density), [set, topicIds, density]);
  const focus = useMemo<SubwayFocus | null>(
    () => (activeTopic ? resolveSubwayFocus(set, explorerNodes, activeTopic, density) : null),
    [set, explorerNodes, activeTopic, density],
  );
  const view = focus?.geometry ?? full;
  const { nodes, edges, bounds, bands, zones, pill } = view;
  const focusKey = focus?.topicId ?? null;
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const fullById = useMemo(() => new Map(full.nodes.map((n) => [n.id, n])), [full.nodes]);
  const lineByTopic = useMemo(() => new Map(lines.map((l) => [l.topicId, l])), [lines]);
  const rootNode = useMemo(() => nodes.find((n) => n.level === 0) ?? null, [nodes]);
  const selectedId = selection?.id ?? null;

  // Km 0 spans every row that leaves it: the whole stack in the full map, the rows of one line in focus.
  const rootId = rootNode?.id;
  const pillSpan = useMemo(() => {
    let { y0, y1 } = pill;
    for (const e of edges) {
      if (e.from !== rootId || !e.pts?.length) continue;
      y0 = Math.min(y0, e.pts[0][1]);
      y1 = Math.max(y1, e.pts[0][1]);
    }
    return { ...pill, y0, y1 };
  }, [pill, edges, rootId]);

  const panBounds = useMemo<Bounds4>(
    // On a phone the home framing leaves room above the map for the sign: let the camera reach it.
    () => ({ x0: bounds.minX - PAD, y0: bounds.minY - PAD - (safeTop > 0 ? 420 : 0), x1: bounds.maxX + PAD, y1: bounds.maxY + PAD }),
    [bounds, safeTop],
  );

  // Home framing and reset (see `frameOf`). `live` makes both read the latest view at call time.
  const viewRef = useRef({ view, panBounds, focused: !!focus, safeTop, safeRight });
  useEffect(() => {
    viewRef.current = { view, panBounds, focused: !!focus, safeTop, safeRight };
  });
  const frame = useCallback((p: PanZoomApi, instant: boolean) => {
    const { width, height } = p.getViewportSize();
    if (width <= 0 || height <= 0) return;
    const cur = viewRef.current;
    const f = frameOf(cur.view, cur.panBounds, width, height, cur.focused, cur.safeTop, cur.safeRight);
    if (!f.topLeft) p.fitToBounds(0, instant);
    else p.centerOn(f.topLeft.x + width / 2 / f.k, f.topLeft.y + height / 2 / f.k, f.k, instant);
  }, []);
  const reset = useCallback(
    (p: PanZoomApi) => {
      // A phone's "see the whole network" is the whole network; elsewhere reset is the home framing.
      if (p.getViewportSize().width < NARROW_PX && !viewRef.current.focused) p.fitToBounds(0, false);
      else frame(p, false);
    },
    [frame],
  );

  const { svgRef, gRef, pan } = useMapView({
    panBounds,
    nodeById,
    geometry: full,
    selectedId,
    insets,
    animateRefit,
    handleRef: ref,
    frame,
    reset,
    maxZoom: MAX_ZOOM,
    // A single line on desktop is fitted whole: keep it clear of the focus bar above and the links below.
    reserve: safeTop === 0 ? (focus ? { top: 78, bottom: 72, right: safeRight } : { right: safeRight }) : undefined,
  });
  const { transform: tf } = pan;

  // First framing, once the svg has a size.
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const go = () => {
      if (pan.getViewportSize().width > 0) frame(pan, true);
      else if (tries++ < 30) raf = requestAnimationFrame(go);
    };
    go();
    return () => cancelAnimationFrame(raf);
    // Mount only: later changes of the view have their own framing below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The sign was measured after mount: frame again, under it, unless the reader already moved on.
  const prevSafeTop = useRef(0);
  useEffect(() => {
    const was = prevSafeTop.current;
    prevSafeTop.current = safeTop;
    if (was !== safeTop && safeTop > 0 && !selectedId) frame(pan, true);
    // A change of the measured sign re-frames (not while a station is open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTop]);
  const prevSafeRight = useRef(0);
  useEffect(() => {
    const was = prevSafeRight.current;
    prevSafeRight.current = safeRight;
    if (was !== safeRight && safeRight > 0 && !selectedId && !focusKey) frame(pan, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeRight]);

  // Entering, leaving or switching the focus: back to the home framing of the new view.
  const prevFocusKey = useRef(focusKey);
  useEffect(() => {
    if (prevFocusKey.current === focusKey) return;
    prevFocusKey.current = focusKey;
    frame(pan, false);
  }, [focusKey, frame, pan]);

  const navNodes = useMemo<NavNode[]>(() => {
    const n = Math.max(nodes.length, 1);
    return nodes.map((s) => ({ id: s.id, ring: s.level, angle: (s.rank / n) * TAU * 0.999 }));
  }, [nodes]);
  const getPosition = useCallback((id: string) => nodeById.get(id), [nodeById]);
  // Escape peels one layer: the open station first, then the line in focus.
  const onClear = useCallback(() => {
    if (selectedId) onSelect(null);
    else if (focusKey) onTopic(null);
  }, [selectedId, focusKey, onSelect, onTopic]);
  const kb = useGraphKeyboard({
    nodes: navNodes,
    axis: "horizontal",
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

  // `morph` is on only while the focus changes: transitions apply then and never on a density switch.
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
    (e: LayoutEdge, byId: ReadonlyMap<string, SubwayMapNode>) =>
      lineColor(byId.get(e.to)?.topicId ?? byId.get(e.from)?.topicId),
    [],
  );
  /** The spine and the first leg of every line are drawn full weight; the branches are lighter at rest. */
  const isTrunk = useCallback((e: LayoutEdge, byId: ReadonlyMap<string, SubwayMapNode>) => {
    const to = byId.get(e.to);
    return to?.role === "spine" || (byId.get(e.from)?.level ?? 0) <= 1;
  }, []);

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
  // In a subway diagram the interchange is the main information: every station that has one wears a faint ring.
  const relatedAny = useMemo(() => {
    const ends = new Set<string>();
    for (const e of edges) {
      if (e.kind !== "related") continue;
      ends.add(e.from);
      ends.add(e.to);
    }
    return ends;
  }, [edges]);

  const pickNode = useCallback((id: string) => onSelect(id), [onSelect]);

  const lastById = useMemo(() => new Map((focusLayer?.geometry.nodes ?? []).map((n) => [n.id, n])), [focusLayer]);
  const renderTrack = (e: LayoutEdge, byId: ReadonlyMap<string, SubwayMapNode>) => {
    if (e.kind === "related") return null;
    const rail = e.kind === "implicitRoot";
    return (
      <path
        key={edgeKey(e)}
        className={rail ? styles.rail : base.track}
        data-kind={e.kind}
        data-tone={edgeTone(e)}
        data-trunk={isTrunk(e, byId) ? "true" : "false"}
        d={e.path}
        style={{ "--ink": targetInk(e, byId) } as CSSProperties}
      />
    );
  };

  /* ---- combinations with other lines (focus mode): a disc per line above the station ---- */
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
  // Reference zoom: the home framing. Label sizes and thresholds hang from it.
  const vp = pan.getViewportSize();
  const kFit = useMemo(
    () => (vp.width > 0 ? frameOf(view, panBounds, vp.width, vp.height, !!focus, safeTop, safeRight).k : 1),
    [view, panBounds, vp.width, vp.height, focus, safeTop, safeRight],
  );
  const ls = m * clamp(k / Math.min(kFit, k), 1, sc.maxGrow);
  const tagScale = Math.max(ls, TAG_MIN_SCALE);
  const hitR = Math.max(11, Math.min(HIT_R * 2, HIT_PX / k));
  const narrow = vp.width > 0 && vp.width < NARROW_PX;

  /* ---- labels: greedy collision pass (screen space) ---- */
  const reserved = useMemo<Box[]>(() => {
    const boxes: Box[] = [];
    const w = pillSpan.width * m;
    const cy = ((pillSpan.y0 + pillSpan.y1) / 2) * k;
    boxes.push(aabb(pillSpan.x * k, cy, (w / 2) * k + 6, ((pillSpan.y1 - pillSpan.y0) / 2 + w / 2) * k + 6));
    const nameY = focus ? (pillSpan.y1 + 22 * m) * k + 10 * ls : (pillSpan.y0 - 16 * m) * k - 10 * ls;
    const nameW = ((23 * 9.2) / 2 + 4) * ls;
    boxes.push(aabb(pillSpan.x * k + (narrow ? nameW - (w / 2) * k : -nameW + (w / 2) * k), nameY, nameW, 10 * ls));
    for (const b of bands) {
      // Right end disc.
      boxes.push(aabb(b.endX * k + END_GAP * sc.terminus, b.spineY * k, 18 * sc.terminus, 18 * sc.terminus));
    }
    return boxes;
  }, [pillSpan, bands, k, m, ls, sc.terminus, focus, narrow]);

  const tagFocus = hovered ?? selectedId;
  const xTagCands = useMemo<XTag[]>(() => buildXTags(edges, tagFocus, (e) => e.mid), [edges, tagFocus]);
  const segments = useMemo<Segment[]>(() => {
    const out: Segment[] = [];
    for (const e of edges) {
      if (e.kind === "related" || !e.pts) continue;
      for (let i = 1; i < e.pts.length; i++) out.push([e.pts[i - 1][0], e.pts[i - 1][1], e.pts[i][0], e.pts[i][1]]);
    }
    return out;
  }, [edges]);
  const { labels, tags } = useMemo(
    () =>
      placeSubwayLabels({
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
        segments,
      }),
    [nodes, k, kFit, sc, selection, hovered, activeTopic, toneOfNode, reserved, xTagCands, segments],
  );

  const hoveredNode = hovered ? nodeById.get(hovered) : undefined;
  const hoveredLine = hoveredNode ? lineByTopic.get(hoveredNode.topicId ?? "") : undefined;
  const hoveredCross = hovered ? crossMarks.get(hovered) : undefined;
  const focusLine = focusKey ? lineByTopic.get(focusKey) : undefined;

  const lineNames = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const l of lines) out.set(l.topicId, wrapName(l.name));
    return out;
  }, [lines]);

  const stationLabel = (n: SubwayMapNode, isRead: boolean): string => {
    const line = n.topicId ? lineByTopic.get(n.topicId) : undefined;
    const cross = crossMarks.get(n.id);
    const combines = cross?.length ? `combina con ${cross.length > 1 ? "las líneas" : "la línea"} ${cross.map((c) => c.letter).join(" y ")}` : null;
    const status = [recLabels[n.recommendation].label, isRead ? "leído" : null, n.incomplete ? "por completar" : null, combines].filter(Boolean).join(", ");
    return n.level === 0
      ? `${n.title}, kilómetro 0${isRead ? ", leído" : ""}`
      : `${n.title}, línea ${line?.letter ?? "?"}, zona ${n.level}${status ? `, ${status}` : ""}`;
  };

  const s = sc.terminus;

  return (
    <div
      className={base.map}
      data-morph={morph ? "true" : undefined}
      data-focus={focusKey ?? undefined}
      data-view="subte"
      style={{ "--k": k, "--m": m, "--ts": tagScale } as CSSProperties}
    >
      <svg
        ref={svgRef}
        className={base.svg}
        role="group"
        aria-label="Mapa de lecturas, vista subte"
        aria-describedby="map-help-subte"
        {...kb.containerProps}
      >
        <g ref={gRef}>
          <rect
            className={base.backdrop}
            x={panBounds.x0}
            y={panBounds.y0}
            width={panBounds.x1 - panBounds.x0}
            height={panBounds.y1 - panBounds.y0}
            onClick={() => selectedId && onSelect(null)}
          />
          <Ground geometry={view} activeTopic={activeTopic} />

          {/* Tracks: the whole network, and the line's own layout; one fades out as the other fades in */}
          <g className={base.layer} data-on={focus ? "false" : "true"} aria-hidden="true">
            {full.edges.map((e) => renderTrack(e, fullById))}
          </g>
          {focusLayer ? (
            <g key={focusLayer.topicId} className={base.layer} data-on={focus ? "true" : "false"} aria-hidden="true">
              {focusLayer.geometry.edges.map((e) => renderTrack(e, focus ? nodeById : lastById))}
            </g>
          ) : null}

          {/* Interchanges: a double rule over a halo, so it reads as passing over the tracks it crosses */}
          <g aria-hidden="true">
            {edges.map((e) =>
              e.kind === "related" && relatedActive.keys.has(edgeKey(e)) ? (
                <g key={edgeKey(e)} className={base.related}>
                  <path className={styles.bridgeHalo} d={e.path} />
                  <path className={base.relatedOuter} d={e.path} />
                  <path className={base.relatedInner} d={e.path} />
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
                  className={edge.kind === "implicitRoot" ? `${base.run} ${styles.runStatic}` : base.run}
                  d={edge.path}
                  pathLength={1}
                  style={{ "--ink": targetInk(edge, nodeById), "--i": index, "--n": route.n } as CSSProperties}
                />
              ))}
            </g>
          ) : null}

          {/* Stations: every one keeps a slot; the ones outside the line in focus fade out where they are */}
          <g>
            {full.nodes.map((fullNode) => {
              const focused = focus ? nodeById.get(fullNode.id) : undefined;
              const n = focused ?? fullNode;
              const out = !!focus && !focused;
              const line = n.topicId ? lineByTopic.get(n.topicId) : undefined;
              const isRead = read.has(n.id);
              const np = kb.getNodeProps(n.id);
              const cross = crossMarks.get(n.id);
              if (n.level === 0) {
                return (
                  <RootPill
                    key={n.id}
                    node={n}
                    pill={pillSpan}
                    m={m}
                    tone={toneOfNode(n.id)}
                    read={isRead}
                    selected={np["aria-pressed"]}
                    tabIndex={np.tabIndex}
                    ariaLabel={stationLabel(n, isRead)}
                    onPick={pickNode}
                    onHover={setHovered}
                    onFocusId={onFocusId}
                  />
                );
              }
              return (
                <Station
                  key={n.id}
                  node={n}
                  color={line?.color ?? "var(--fg)"}
                  tone={toneOfNode(n.id)}
                  out={out}
                  cross={cross}
                  crossAt="above"
                  read={isRead}
                  selected={np["aria-pressed"]}
                  interchange={relatedActive.ends.has(n.id)}
                  interchangeFaint={relatedAny.has(n.id)}
                  m={m}
                  hitR={hitR}
                  tabIndex={np.tabIndex}
                  ariaLabel={stationLabel(n, isRead)}
                  onPick={pickNode}
                  onHover={setHovered}
                  onFocusId={onFocusId}
                />
              );
            })}
          </g>

          {/* Keyed by mode: the labels of a new layout fade in once the stations have arrived. */}
          <g key={focusKey ?? "all"} className={base.late}>
            <StationLabels labels={labels} k={k} ls={ls} />
            <InterchangeTags tags={tags} k={k} scale={tagScale} />
          </g>

          {rootNode ? (
            <text
              className={base.rootLabel}
              aria-hidden="true"
              x={narrow ? pill.x - (pill.width * m) / 2 : pill.x + (pill.width * m) / 2}
              y={focus ? pillSpan.y1 + 22 * m + (10 * ls) / k : pillSpan.y0 - 16 * m - (10 * ls) / k}
              textAnchor={narrow ? "start" : "end"}
              fontSize={(12 * ls) / k}
              strokeWidth={(5 * ls) / k}
            >
              KM 0 · TOM SAWYER ABROAD
            </text>
          ) : null}

          {/* Line heads: lettered disc and name left of Km 0, a small disc at the end of the band.
              Click on either = put the line in focus (again = back to the map). */}
          <g>
            {full.bands.map((fullBand) => {
              const line = lineByTopic.get(fullBand.topicId);
              if (!line) return null;
              const b = focus ? (focus.topicId === fullBand.topicId ? focus.geometry.bands[0] : undefined) : fullBand;
              const out = !b;
              const at = b ?? fullBand;
              const active = activeTopic === fullBand.topicId;
              const nm = lineNames.get(fullBand.topicId) ?? [];
              const label = active ? `Salir de la línea ${line.letter}: ${line.name}` : `Ver solo la línea ${line.letter}: ${line.name}`;
              const toggle = () => onTopic(active ? null : fullBand.topicId);
              const off = (pill.width * m * k) / 2 / s + HEAD_GAP;
              const nameW = Math.max(...nm.map((l) => l.length), 2) * NAME_CH + 14;
              // A name that would leave the screen is not drawn (the disc still says the letter).
              const nameLeft = tf.x + pill.x * k - off * s - DISC_R * s - 10 * s - nameW * s;
              const showName = !narrow && nameLeft >= 4;
              return (
                <g key={fullBand.topicId}>
                  <g
                    className={base.terminus}
                    data-out={out ? "true" : undefined}
                    data-active={active ? "true" : undefined}
                    role="button"
                    tabIndex={out ? -1 : 0}
                    aria-pressed={active}
                    aria-hidden={out ? true : undefined}
                    aria-label={label}
                    style={{ "--ink": line.color, transform: `translate(${pill.x}px, ${at.spineY}px)` } as CSSProperties}
                    onClick={toggle}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle();
                      }
                    }}
                  >
                    <g transform={`scale(${(s / k).toFixed(4)})`}>
                      <rect
                        className={base.terminusHit}
                        x={-off - DISC_R - (showName ? nameW + 10 : 4)}
                        y={-DISC_R - 4}
                        width={DISC_R * 2 + (showName ? nameW + 10 : 4) + 8}
                        height={DISC_R * 2 + 8}
                        rx={4}
                      />
                      <g transform={`translate(${-off} 0)`}>
                        <circle r={DISC_R} className={base.terminusDisc} />
                        <text className={base.terminusLetter} y={1}>
                          {line.letter}
                        </text>
                      </g>
                      {showName ? (
                        <text className={styles.headName} aria-hidden="true" fontSize={NAME_PX} data-active={active ? "true" : undefined}>
                          {nm.map((l, i) => (
                            <tspan key={i} x={-off - DISC_R - 10} y={(i - (nm.length - 1) / 2) * NAME_LINE}>
                              {l}
                            </tspan>
                          ))}
                        </text>
                      ) : null}
                    </g>
                  </g>
                  <g
                    className={base.terminus}
                    data-out={out ? "true" : undefined}
                    data-active={active ? "true" : undefined}
                    aria-hidden="true"
                    style={{ "--ink": line.color, transform: `translate(${at.endX}px, ${at.spineY}px)` } as CSSProperties}
                    onClick={toggle}
                  >
                    <g transform={`scale(${((s * 0.78) / k).toFixed(4)})`}>
                      <g transform={`translate(${END_GAP} 0)`}>
                        <circle r={DISC_R + 6} className={base.terminusHit} />
                        <circle r={DISC_R} className={base.terminusDisc} />
                        <text className={base.terminusLetter} y={1}>
                          {line.letter}
                        </text>
                      </g>
                    </g>
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Zone header: fixed over the top of the stage, follows the horizontal pan and zoom only. */}
      <div className={styles.zoneStrip} data-focus={focus ? "true" : undefined} aria-hidden="true">
        {zones.map((z) => {
          const left = tf.x + z.x0 * k;
          const width = (z.x1 - z.x0) * k;
          if (left + width < 0 || left > vp.width || width < 20) return null;
          return (
            <span key={z.level} className={styles.zoneCell} style={{ left, width }}>
              <span className={styles.zoneNum}>{z.level}</span>
              {width >= 96 ? <span className={styles.zoneName}>{ZONE_NAMES[z.level]}</span> : null}
            </span>
          );
        })}
      </div>

      <p className={base.srOnly} role="status" aria-live="polite">
        {announce}
      </p>

      {focus && focusLine ? (
        <FocusBar line={focusLine} count={focus.count} parked={!!insets?.right} onExit={() => onTopic(null)} />
      ) : null}

      <p id="map-help-subte" className={base.srOnly}>
        Usá las flechas para moverte entre estaciones: arriba y abajo, las de la misma zona; derecha, la zona siguiente;
        izquierda, la zona anterior. Enter abre la estación, Escape la cierra, más y menos acercan y alejan.
      </p>

      <MapLegend recLabels={recLabels} insetRight={insets?.right}>
        <p className={base.legendKey}>
          <svg className={styles.legendRail} viewBox="0 0 44 20" aria-hidden="true">
            <path d="M2 10H42" />
          </svg>
          <span className={base.legendKeyText}>
            <span className={base.legendKeyName}>Riel tenue</span>
            <span>Arrancan en Km 0, sin orden entre sí</span>
          </span>
        </p>
      </MapLegend>

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
