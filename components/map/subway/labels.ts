/**
 * Label placement for the subway view. Labels are always horizontal and live in screen space
 * (counter-scaled), like the radial ones, but they sit above or below their own track, to the
 * right or left of the mark: four candidate slots (ne, se, nw, sw). The greedy pass keeps the
 * radial priorities and thresholds and adds the tracks as obstacles.
 *
 * Pure: no React, no DOM. Boxes are in screen px relative to the map origin (world * k).
 */
import type { Selection } from "@/lib/state/explorer";
import type { DensityScale } from "@/lib/density";
import type { SubwayLabelSlot } from "@/lib/catalog/subway.types";
import {
  LABEL_CH,
  LABEL_LINE,
  LABEL_MIN_REL,
  WRAP_CHARS,
  aabb,
  boxesOverlap,
  clamp,
  truncate,
  wrapTitle,
  type Box,
  type Tone,
} from "../shared/geometry";
import { TAG_MIN_SCALE, XTAG_H, type XTag } from "../shared/InterchangeTags";
import type { SubwayMapNode } from "./types";

/** A track segment in world coordinates. */
export type Segment = readonly [x0: number, y0: number, x1: number, y1: number];

export interface PlacedSubwayLabel {
  id: string;
  lines: string[];
  tone: Tone;
  pinned: boolean;
  slot: SubwayLabelSlot;
  /** Station (world). */
  x: number;
  y: number;
  /** Anchor of the text relative to the station, in screen px (start of the text for e, end for w). */
  ax: number;
  /** Centre of the text block relative to the station, in screen px. */
  cy: number;
  /** Text block, in screen px (for tests). */
  w: number;
  h: number;
}

/** Max chars of a one-line label. */
export const SUBWAY_LABEL_MAX = 26;

const SLOT_ORDER: Record<SubwayLabelSlot, SubwayLabelSlot[]> = {
  ne: ["ne", "se", "nw", "sw"],
  se: ["se", "ne", "sw", "nw"],
  nw: ["nw", "sw", "ne", "se"],
  sw: ["sw", "nw", "se", "ne"],
};

/** Does the segment (screen px) cross the box (grown by `pad`)? Slab test; exact for axis-aligned boxes. */
export function segmentHitsBox(x0: number, y0: number, x1: number, y1: number, b: Box, pad = 0): boolean {
  const minX = b.cx - b.hw - pad;
  const maxX = b.cx + b.hw + pad;
  const minY = b.cy - b.hh - pad;
  const maxY = b.cy + b.hh + pad;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, x0 - minX) && clip(dx, maxX - x0) && clip(-dy, y0 - minY) && clip(dy, maxY - y0);
}

/** Candidate box of a label in a slot, centred on the station at (sx, sy) (screen px). */
export function slotBox(
  slot: SubwayLabelSlot,
  sx: number,
  sy: number,
  w: number,
  h: number,
  m: number,
  k: number,
  selected = false,
): { box: Box; ax: number; cy: number } {
  // Clear the mark and its rings (world units, so they grow with the zoom): the interchange ring is r 14,
  // the selection ring r 17. The track's half width sets how far the text rises above it.
  const dx = (selected ? 18.5 : 14.5) * m * k + 4;
  const rise = 3.5 * m * k + 2 + h / 2;
  const east = slot === "ne" || slot === "se";
  const north = slot === "ne" || slot === "nw";
  const ax = east ? dx : -dx;
  const cy = north ? -rise : rise;
  return { box: aabb(sx + ax + (east ? w / 2 : -w / 2), sy + cy, w / 2, h / 2), ax, cy };
}

export function placeSubwayLabels({
  nodes,
  k,
  kFit,
  sc,
  selection,
  hovered,
  topicActive,
  toneOf,
  reserved,
  xTags,
  segments,
}: {
  nodes: readonly SubwayMapNode[];
  k: number;
  /** Reference zoom (the framing of the whole map); thresholds hang from it. */
  kFit: number;
  sc: DensityScale;
  selection: Selection | null;
  hovered: string | null;
  topicActive: boolean;
  toneOf(id: string): Tone;
  reserved: readonly Box[];
  xTags: readonly XTag[];
  /** Tracks (not the combination connectors), world coordinates. */
  segments: readonly Segment[];
}): { labels: PlacedSubwayLabel[]; tags: XTag[] } {
  interface Cand {
    n: SubwayMapNode;
    tone: Tone;
    prio: number;
    pinned: boolean;
    lines: string[];
  }
  const m = sc.mark;
  const rel = k / kFit;
  const ls = m * clamp(rel, 1, sc.maxGrow);
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
    // Two lines and the full title for the selected and hovered stations and everything in a line's focus.
    const full = prio <= 1 || topicActive;
    const lines = full ? wrapTitle(n.title, WRAP_CHARS, 2) : [truncate(n.title, SUBWAY_LABEL_MAX)];
    cands.push({ n, tone, prio, pinned: prio <= 2, lines });
  }
  cands.sort((a, b) => a.prio - b.prio || a.n.level - b.n.level || (a.n.id < b.n.id ? -1 : 1));

  // Tracks in screen px, once.
  const segs: [number, number, number, number][] = segments.map(([a, b, c, d]) => [a * k, b * k, c * k, d * k]);
  const hitsTrack = (box: Box) => {
    for (const [x0, y0, x1, y1] of segs) {
      if (
        Math.max(x0, x1) < box.cx - box.hw - 1 ||
        Math.min(x0, x1) > box.cx + box.hw + 1 ||
        Math.max(y0, y1) < box.cy - box.hh - 1 ||
        Math.min(y0, y1) > box.cy + box.hh + 1
      )
        continue;
      if (segmentHitsBox(x0, y0, x1, y1, box, 0)) return true;
    }
    return false;
  };

  const tagScale = Math.max(ls, TAG_MIN_SCALE);
  const placed: Box[] = [];
  const out: PlacedSubwayLabel[] = [];
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
  const dotHalf = Math.max(9 * m, 11 * m * k);
  for (const c of cands) {
    if (!tagsDone && c.prio > 0) placeTags();
    const { n } = c;
    const w = (Math.max(...c.lines.map((l) => l.length)) * LABEL_CH + 4) * ls;
    const h = (c.lines.length * LABEL_LINE + 2) * ls;
    const sx = n.x * k;
    const sy = n.y * k;
    // The selected and hovered labels always show, even over a track; the rest must find a clear slot.
    const pinnedFirst = c.prio <= 1;
    type Chosen = { box: Box; ax: number; cy: number; slot: SubwayLabelSlot };
    let chosen: Chosen | null = null;
    let fallback: Chosen | null = null;
    for (const slot of SLOT_ORDER[n.labelSlot]) {
      const s = slotBox(slot, sx, sy, w, h, m, k, c.prio === 0);
      if (reserved.some((r) => boxesOverlap(s.box, r, 3)) || placed.some((p) => boxesOverlap(s.box, p, 3))) continue;
      if (c.prio === 3 || c.prio === 5 || c.prio === 4) {
        const onDot = nodes.some(
          (o) => o.id !== n.id && o.level !== 0 && boxesOverlap(s.box, aabb(o.x * k, o.y * k, dotHalf, dotHalf), 0),
        );
        if (onDot) continue;
      }
      if (hitsTrack(s.box)) {
        fallback ??= { ...s, slot };
        continue;
      }
      chosen = { ...s, slot };
      break;
    }
    if (!chosen && pinnedFirst) chosen = fallback;
    if (!chosen) continue;
    placed.push(chosen.box);
    out.push({
      id: n.id,
      lines: c.lines,
      tone: c.tone,
      pinned: c.pinned,
      slot: chosen.slot,
      x: n.x,
      y: n.y,
      ax: chosen.ax,
      cy: chosen.cy,
      w,
      h,
    });
  }
  if (!tagsDone) placeTags();
  return { labels: out, tags: outTags };
}
