"use client";

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type Ref,
} from "react";
import { LineDisc } from "@/components/ui/LineDisc";
import { usePanZoom } from "@/hooks/usePanZoom";
import { useGraphKeyboard } from "@/hooks/useGraphKeyboard";
import { lineColor } from "@/lib/design/lines";
import type { Selection } from "@/lib/state/explorer";
import type { LayoutEdge } from "@/lib/catalog/layout.types";
import type { NavNode } from "@/lib/graph-interaction";
import { fitScale } from "@/lib/graph-interaction/viewport";
import { ZONE_NAMES, type MapGeometry, type MapLine, type MapNode } from "./types";
import styles from "./NetworkMap.module.css";

export interface NetworkMapHandle {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  /** Center a station (default: keep zoom, at least `minK`), compensating overlays. */
  centerOn(id: string, minK?: number): void;
}

export interface NetworkMapProps {
  geometry: MapGeometry;
  lines: readonly MapLine[];
  selection: Selection | null;
  /** Ids dimmed by the topic filter. */
  dimmed: ReadonlySet<string>;
  activeTopic: string | null;
  read: ReadonlySet<string>;
  onSelect(id: string | null): void;
  /** Px covered by overlays (side panel / bottom sheet). */
  insets?: { right?: number; bottom?: number };
  /** Animate the re-fit when `geometry` changes (density switch). Off = instant (first load). */
  animateRefit?: boolean;
  ref?: Ref<NetworkMapHandle>;
}

type Tone = "full" | "mid" | "dim";

const HIT_R = 24;
const PAD = 100;
const LABEL_PX = 11;
const LABEL_CH = 7.6; // estimated advance of one uppercase label glyph (px at LABEL_PX)
const LABEL_LINE = 13;
const LABEL_GAP = 15; // station centre to first glyph
const LABEL_MIN_K: Record<number, number> = { 1: 0.85, 2: 1.0, 3: 1.15, 4: 0.75 };
/** Entry-station titles appear from this zoom up (desktop fit ~0.5; phone fit ~0.22 shows discs only). */
const ENTRY_MIN_K = 0.35;
const WRAP_CHARS = 22;
const TAU = Math.PI * 2;

const edgeKey = (e: { from: string; to: string }) => `${e.from}>${e.to}`;
const deg = (rad: number) => (rad * 180) / Math.PI;
const polar = (r: number, a: number) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}\u2026` : text;
}

/** Greedy word wrap to at most `maxLines` lines; the last line is truncated only if still too long. */
function wrapTitle(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines - 1);
  kept.push(truncate(lines.slice(maxLines - 1).join(" "), maxChars));
  return kept;
}

/* Oriented boxes in screen space (u = unit direction of the long axis). */
interface Box {
  cx: number;
  cy: number;
  ux: number;
  uy: number;
  hw: number;
  hh: number;
}

function boxesOverlap(a: Box, b: Box, pad = 2): boolean {
  const axes = [
    [a.ux, a.uy],
    [-a.uy, a.ux],
    [b.ux, b.uy],
    [-b.uy, b.ux],
  ];
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  for (const [ax, ay] of axes) {
    const ra = a.hw * Math.abs(a.ux * ax + a.uy * ay) + a.hh * Math.abs(-a.uy * ax + a.ux * ay);
    const rb = b.hw * Math.abs(b.ux * ax + b.uy * ay) + b.hh * Math.abs(-b.uy * ax + b.ux * ay);
    if (Math.abs(dx * ax + dy * ay) > ra + rb + pad) return false;
  }
  return true;
}

const aabb = (cx: number, cy: number, hw: number, hh: number): Box => ({ cx, cy, ux: 1, uy: 0, hw, hh });

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
}: {
  geometry: MapGeometry;
  activeTopic: string | null;
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
            key={s.topicId}
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
/* Stations                                                            */
/* ------------------------------------------------------------------ */

interface StationProps {
  node: MapNode;
  color: string;
  tone: Tone;
  read: boolean;
  selected: boolean;
  interchange: boolean;
  tabIndex: 0 | -1;
  ariaLabel: string;
  onPick(id: string): void;
  onHover(id: string | null): void;
  onFocusId(id: string, e: FocusEvent<Element>): void;
}

const Station = memo(function Station({
  node,
  color,
  tone,
  read,
  selected,
  interchange,
  tabIndex,
  ariaLabel,
  onPick,
  onHover,
  onFocusId,
}: StationProps) {
  const isRoot = node.level === 0;
  return (
    <g
      className={styles.station}
      data-id={node.id}
      data-tone={tone}
      data-read={read ? "true" : undefined}
      data-root={isRoot ? "true" : undefined}
      role="button"
      tabIndex={tabIndex}
      aria-pressed={selected}
      aria-label={ariaLabel}
      transform={`translate(${node.x} ${node.y})`}
      style={{ "--ink": color } as CSSProperties}
      onClick={() => onPick(node.id)}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={(e) => {
        onFocusId(node.id, e);
        onHover(node.id);
      }}
      onBlur={() => onHover(null)}
    >
      <circle className={styles.hit} r={isRoot ? 44 : HIT_R} />
      <circle className={styles.focusRing} r={isRoot ? 36 : 17} />
      {isRoot ? (
        <>
          <circle className={styles.rootOuter} r={24} />
          <circle className={styles.rootInner} r={13} />
        </>
      ) : (
        <>
          {node.entry ? (
            <rect
              className={styles.tick}
              x={-3.5}
              y={-14}
              width={7}
              height={28}
              transform={`rotate(${deg(node.angle).toFixed(1)})`}
            />
          ) : null}
          {interchange ? <circle className={styles.interchange} r={14} /> : null}
          {selected ? <circle className={styles.selectedRing} r={17} /> : null}
          <circle className={styles.dot} r={7} />
          {node.incomplete ? <path className={styles.notch} d="M6 -14 L15 -14 L15 -5 Z" /> : null}
        </>
      )}
    </g>
  );
});

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
}: {
  nodes: readonly MapNode[];
  k: number;
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
    else if (n.entry && tone !== "dim" && k >= ENTRY_MIN_K) prio = 4;
    else {
      const threshold = (LABEL_MIN_K[n.level] ?? 1) * (topicActive && tone === "full" ? 0.72 : 1);
      if (tone === "dim" || k < threshold) continue;
    }
    const wrapped = prio <= 4;
    const lines = wrapped ? wrapTitle(n.title, WRAP_CHARS, 2) : [truncate(n.title, maxChars(n.level))];
    cands.push({ n, tone, prio, pinned: prio <= 2, lines });
  }
  cands.sort((a, b) => a.prio - b.prio || a.n.level - b.n.level || (a.n.id < b.n.id ? -1 : 1));

  const placed: Box[] = [];
  const out: PlacedLabel[] = [];
  const outTags: XTag[] = [];
  let tagsDone = false;
  // Interchange tags rank just below the selected station's label.
  const placeTags = () => {
    tagsDone = true;
    for (const t of xTags) {
      const box = aabb(t.x * k, t.y * k, t.w / 2, XTAG_H / 2);
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
    const w = Math.max(...c.lines.map((l) => l.length)) * LABEL_CH + 4;
    const h = c.lines.length * LABEL_LINE + 2;
    const lx = (left ? -1 : 1) * (LABEL_GAP + w / 2);
    const ly = -6 - ((c.lines.length - 1) * LABEL_LINE) / 2;
    const sx = n.x * k;
    const sy = n.y * k;
    const box: Box = { cx: sx + lx * ux - ly * uy, cy: sy + lx * uy + ly * ux, ux, uy, hw: w / 2, hh: h / 2 };
    let hit = reserved.some((r) => boxesOverlap(box, r, 3)) || placed.some((p) => boxesOverlap(box, p, 3));
    if (!hit && (c.prio === 3 || c.prio === 5)) {
      hit = nodes.some(
        (o) => o.id !== n.id && o.level !== 0 && boxesOverlap(box, aabb(o.x * k, o.y * k, 9, 9), 0),
      );
    }
    if (hit) continue;
    placed.push(box);
    out.push({ id: n.id, lines: c.lines, tone: c.tone, pinned: c.pinned, left, rot: deg(rot), x: n.x, y: n.y });
  }
  if (!tagsDone) placeTags();
  return { labels: out, tags: outTags };
}

interface XTag {
  key: string;
  x: number;
  y: number;
  w: number;
  reason: string;
  full: string;
}

const XTAG_H = 36;
const XTAG_REASON_MAX = 40;

/** Midpoint (t = 0.5) of the quadratic `M ax ay Q cx cy bx by` that layout emits for related edges. */
function relatedMidpoint(path: string): { x: number; y: number } | null {
  const n = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!n || n.length < 6) return null;
  return { x: 0.25 * n[0] + 0.5 * n[2] + 0.25 * n[4], y: 0.25 * n[1] + 0.5 * n[3] + 0.25 * n[5] };
}

/** Signage tag at the midpoint of an interchange: glyph, COMBINACIÓN, and the reason. Counter-scaled. */
function InterchangeTags({ tags, k }: { tags: readonly XTag[]; k: number }) {
  return (
    <g aria-hidden="true">
      {tags.map((t) => (
        <g
          key={t.key}
          className={styles.xTag}
          transform={`translate(${t.x.toFixed(1)} ${t.y.toFixed(1)}) scale(${(1 / k).toFixed(4)})`}
        >
          <title>{`Combinación: ${t.full}`}</title>
          <rect className={styles.xTagPlate} x={-t.w / 2} y={-XTAG_H / 2} width={t.w} height={XTAG_H} />
          <g transform={`translate(${-t.w / 2 + 17} 0)`}>
            <circle className={styles.xTagGlyph} cx={-4} r={4.4} />
            <circle className={styles.xTagGlyph} cx={4} r={4.4} />
          </g>
          <text className={styles.xTagTitle} x={-t.w / 2 + 32} y={-7}>
            COMBINACIÓN
          </text>
          <text className={styles.xTagReason} x={-t.w / 2 + 32} y={8}>
            {t.reason}
          </text>
        </g>
      ))}
    </g>
  );
}

function StationLabels({
  labels,
  k,
}: {
  labels: readonly PlacedLabel[];
  k: number;
}) {
  const fs = LABEL_PX / k;
  const lh = LABEL_LINE / k;
  return (
    <g aria-hidden="true">
      {labels.map((l) => {
        const x = (l.left ? -1 : 1) * (LABEL_GAP / k);
        const y0 = -(6 / k) - ((l.lines.length - 1) * lh) / 2;
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
            strokeWidth={4 / k}
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
  lines,
  selection,
  dimmed,
  activeTopic,
  read,
  onSelect,
  insets,
  animateRefit = false,
  ref,
}: NetworkMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, edges, bounds } = geometry;
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const lineByTopic = useMemo(() => new Map(lines.map((l) => [l.topicId, l])), [lines]);
  const rootNode = useMemo(() => nodes.find((n) => n.level === 0) ?? null, [nodes]);
  const selectedId = selection?.id ?? null;

  const panBounds = useMemo(
    () => ({ x0: bounds.minX - PAD, y0: bounds.minY - PAD, x1: bounds.maxX + PAD, y1: bounds.maxY + PAD }),
    [bounds],
  );
  const pan = usePanZoom(svgRef, gRef, { bounds: panBounds, minZoom: "fit", maxZoom: 3.5 });
  const { transform: tf } = pan;

  const navNodes = useMemo<NavNode[]>(() => nodes.map((n) => ({ id: n.id, angle: n.angle, ring: n.level })), [nodes]);
  const getPosition = useCallback((id: string) => nodeById.get(id), [nodeById]);
  const onClear = useCallback(() => onSelect(null), [onSelect]);
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

  // Latest handlers for stable callbacks (written in an effect, read at event time).
  const live = useRef({ getNodeProps: kb.getNodeProps, pan, insets });
  useEffect(() => {
    live.current = { getNodeProps: kb.getNodeProps, pan, insets };
  });
  const onFocusId = useCallback((id: string, e: FocusEvent<Element>) => live.current.getNodeProps(id).onFocus(e), []);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => live.current.pan.zoomIn(),
      zoomOut: () => live.current.pan.zoomOut(),
      reset: () => live.current.pan.reset(),
      centerOn: (id, minK) => {
        const n = nodeById.get(id);
        if (!n) return;
        const { pan: p, insets: ins } = live.current;
        const k = Math.max(p.getTransform().k, minK ?? 0);
        p.centerOn(n.x + (ins?.right ?? 0) / 2 / k, n.y + (ins?.bottom ?? 0) / 2 / k, k);
      },
    }),
    [nodeById],
  );

  // Density switch: new geometry. Positions swap at once (never animated); only the camera
  // moves. Without a selection, re-fit; with one, keep it centred at the same relative framing.
  // The snapshot effect below runs after this one, so `snap` still holds the previous geometry.
  const snap = useRef<{ k: number; bounds: typeof panBounds } | null>(null);
  const prevGeometry = useRef(geometry);
  useEffect(() => {
    const prev = snap.current;
    if (prevGeometry.current === geometry) return;
    prevGeometry.current = geometry;
    const { pan: p, insets: ins } = live.current;
    const instant = !animateRefit;
    const n = selectedId ? nodeById.get(selectedId) : undefined;
    if (!n || !prev) {
      p.fitToBounds(0, instant);
      return;
    }
    const size = p.getViewportSize();
    const ratio = size.width > 0 ? fitScale(panBounds, size) / fitScale(prev.bounds, size) : 1;
    const k = prev.k * ratio;
    p.centerOn(n.x + (ins?.right ?? 0) / 2 / k, n.y + (ins?.bottom ?? 0) / 2 / k, k, instant);
  }, [geometry, selectedId, nodeById, panBounds, animateRefit]);
  useEffect(() => {
    snap.current = { k: pan.getTransform().k, bounds: panBounds };
  });

  // A selection already in the URL on load: bring it into view once.
  const bootCentered = useRef(false);
  useEffect(() => {
    if (bootCentered.current || !selectedId) return;
    bootCentered.current = true;
    const n = nodeById.get(selectedId);
    if (!n) return;
    const raf = requestAnimationFrame(() => {
      const { pan: p, insets: ins } = live.current;
      const k = Math.max(p.getTransform().k, 0.9);
      p.centerOn(n.x + (ins?.right ?? 0) / 2 / k, n.y + (ins?.bottom ?? 0) / 2 / k, k);
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, nodeById]);

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
  const route = useMemo(() => {
    if (!selection) return null;
    const P = selection.prerequisites;
    const U = selection.unlocks;
    const trackEdges = edges.filter((e) => e.kind !== "related");
    const run: LayoutEdge[] = [];
    const unlock = new Set<string>();
    for (const e of trackEdges) {
      if ((e.to === selection.id || P.has(e.to)) && P.has(e.from)) run.push(e);
      else if ((e.from === selection.id || U.has(e.from)) && U.has(e.to)) unlock.add(edgeKey(e));
    }
    const rootId = rootNode?.id;
    const depth = new Map<string, number>(rootId ? [[rootId, 0]] : []);
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;
      for (const e of run) {
        const d = depth.get(e.from);
        if (d === undefined) continue;
        if ((depth.get(e.to) ?? Infinity) > d + 1) {
          depth.set(e.to, d + 1);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const steps = run.map((e) => depth.get(e.from) ?? 0);
    const n = Math.max(1, ...steps.map((s) => s + 1));
    return { run: run.map((e, i) => ({ edge: e, index: steps[i] })), runKeys: new Set(run.map(edgeKey)), unlock, n };
  }, [selection, edges, rootNode]);

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
    (e: LayoutEdge) => lineColor(nodeById.get(e.to)?.topicId ?? nodeById.get(e.from)?.topicId),
    [nodeById],
  );

  /** Main trunk = the first leg of every line (KM 0 and zone 1 outward); deeper legs are drawn lighter at rest. */
  const isTrunk = useCallback(
    (e: LayoutEdge) => (nodeById.get(e.from)?.level ?? 0) <= 1,
    [nodeById],
  );
  /** Implicit KM 0 spokes: hidden at rest, shown for the selected route or the active line. */
  const showSpoke = useCallback(
    (e: LayoutEdge) => {
      if (selection) return route?.runKeys.has(edgeKey(e)) ?? false;
      return !!activeTopic && nodeById.get(e.to)?.topicId === activeTopic;
    },
    [selection, route, activeTopic, nodeById],
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

  const k = tf.k;
  const outer = geometry.rings[geometry.rings.length - 1]?.radius ?? 0;

  /* ---- labels: greedy collision pass (screen space) ---- */
  const reserved = useMemo<Box[]>(() => {
    const boxes: Box[] = [
      // Km 0 disc and its label (the label is 12px type, ~9px per glyph, tracked).
      aabb(0, 0, 24 * k + 6, 24 * k + 6),
      aabb(0, 34 * k + 12, (23 * 9.2) / 2 + 4, 10),
    ];
    for (const s of geometry.sectors) {
      const p = polar(outer + 66, s.labelAngle);
      boxes.push(aabb(p.x * k, p.y * k, 20, 20));
    }
    return boxes;
  }, [geometry.sectors, outer, k]);
  // Tags: the hovered station's interchanges on hover, otherwise all of the selected station's.
  const tagFocus = hovered ?? selectedId;
  const xTagCands = useMemo<XTag[]>(() => {
    if (!tagFocus) return [];
    const out: XTag[] = [];
    for (const e of edges) {
      if (e.kind !== "related" || (e.from !== tagFocus && e.to !== tagFocus)) continue;
      const mid = relatedMidpoint(e.path);
      if (!mid) continue;
      const full = e.reason?.trim() ?? "";
      const reason = truncate(full, XTAG_REASON_MAX);
      out.push({ key: edgeKey(e), x: mid.x, y: mid.y, w: Math.max(122, 44 + reason.length * 5.8), reason, full });
    }
    return out;
  }, [edges, tagFocus]);
  const { labels, tags } = useMemo(
    () =>
      placeLabels({
        nodes,
        k,
        selection,
        hovered,
        topicActive: !!activeTopic,
        toneOf: toneOfNode,
        reserved,
        xTags: xTagCands,
      }),
    [nodes, k, selection, hovered, activeTopic, toneOfNode, reserved, xTagCands],
  );
  const hoveredNode = hovered ? nodeById.get(hovered) : undefined;
  const hoveredLine = hoveredNode ? lineByTopic.get(hoveredNode.topicId ?? "") : undefined;

  return (
    <div className={styles.map} style={{ "--k": k } as CSSProperties}>
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
          <Ground geometry={geometry} activeTopic={activeTopic} />

          {/* Tracks: the base network */}
          <g aria-hidden="true">
            {edges.map((e) => {
              if (e.kind === "related") return null;
              if (e.kind === "implicitRoot" && !showSpoke(e)) return null;
              return (
                <path
                  key={edgeKey(e)}
                  className={styles.track}
                  data-kind={e.kind}
                  data-tone={edgeTone(e)}
                  data-trunk={isTrunk(e) ? "true" : "false"}
                  d={e.path}
                  style={{ "--ink": targetInk(e) } as CSSProperties}
                />
              );
            })}
          </g>

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
                  style={{ "--ink": targetInk(edge), "--i": index, "--n": route.n } as CSSProperties}
                />
              ))}
            </g>
          ) : null}

          {/* Stations */}
          <g>
            {nodes.map((n) => {
              const line = n.topicId ? lineByTopic.get(n.topicId) : undefined;
              const isRead = read.has(n.id);
              const np = kb.getNodeProps(n.id);
              const status = [isRead ? "leído" : null, n.incomplete ? "por completar" : null].filter(Boolean).join(", ");
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
                  read={isRead}
                  selected={np["aria-pressed"]}
                  interchange={relatedActive.ends.has(n.id)}
                  tabIndex={np.tabIndex}
                  ariaLabel={label}
                  onPick={pickNode}
                  onHover={setHovered}
                  onFocusId={onFocusId}
                />
              );
            })}
          </g>

          <StationLabels labels={labels} k={k} />
          <InterchangeTags tags={tags} k={k} />

          {rootNode ? (
            <text
              className={styles.rootLabel}
              aria-hidden="true"
              x={0}
              y={34 + 12 / k}
              textAnchor="middle"
              fontSize={12 / k}
              strokeWidth={5 / k}
            >
              KM 0 · TOM SAWYER ABROAD
            </text>
          ) : null}

          {/* Line termini: lettered discs at the end of each sector */}
          <g aria-hidden="true">
            {geometry.sectors.map((s) => {
              const line = lineByTopic.get(s.topicId);
              if (!line) return null;
              const p = polar(outer + 66, s.labelAngle);
              const dim = activeTopic !== null && activeTopic !== s.topicId;
              return (
                <g
                  key={s.topicId}
                  className={styles.terminus}
                  data-dim={dim ? "true" : undefined}
                  transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(1 / k).toFixed(4)})`}
                  style={{ "--ink": line.color } as CSSProperties}
                >
                  <circle r={15} className={styles.terminusDisc} />
                  <text className={styles.terminusLetter} y={1}>
                    {line.letter}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <p id="map-help" className={styles.srOnly}>
        Usá las flechas para moverte entre estaciones: arriba hacia afuera, abajo hacia el centro, izquierda y derecha
        a lo largo de la zona. Enter abre la estación, Escape la cierra, más y menos acercan y alejan.
      </p>

      <div
        className={styles.legend}
        data-parked={insets?.right ? "true" : undefined}
        tabIndex={insets?.right ? 0 : undefined}
        aria-label="Leyenda del mapa"
        style={{ insetInlineEnd: `${16 + (insets?.right ?? 0)}px` }}
      >
        <p className={styles.legendHead}>
          <svg className={styles.legendRing} viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="8" />
          </svg>
          Zonas
        </p>
        <div className={styles.legendBody}>
          <ol className={styles.legendList}>
            {Object.entries(ZONE_NAMES).map(([level, name]) => (
              <li key={level}>
                <span className={styles.legendNum}>{level}</span>
                {name.charAt(0) + name.slice(1).toLowerCase()}
              </li>
            ))}
          </ol>
          <p className={styles.legendKey}>
            <svg className={styles.legendArc} viewBox="0 0 44 20" aria-hidden="true">
              <path className={styles.arcOuter} d="M4 15Q22 -3 40 15" />
              <path className={styles.arcInner} d="M4 15Q22 -3 40 15" />
            </svg>
            <span className={styles.legendKeyText}>
              <span className={styles.legendKeyName}>Combinación</span>
              <span>Libros que conectan dos líneas</span>
            </span>
          </p>
        </div>
      </div>

      {hoveredNode ? (
        <div
          className={styles.tag}
          aria-hidden="true"
          style={{
            left: tf.x + hoveredNode.x * k,
            top: tf.y + hoveredNode.y * k,
          }}
        >
          {hoveredLine ? <LineDisc letter={hoveredLine.letter} color={hoveredLine.color} size="sm" /> : null}
          <span className={styles.tagText}>
            <span className={styles.tagTitle}>{hoveredNode.title}</span>
            {hoveredNode.titleEs ? <span className={styles.tagSub}>{hoveredNode.titleEs}</span> : null}
          </span>
          <span className={styles.tagZone}>{hoveredNode.level === 0 ? "KM 0" : `Zona ${hoveredNode.level}`}</span>
        </div>
      ) : null}
    </div>
  );
}
