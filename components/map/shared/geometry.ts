/**
 * Pure screen-space helpers shared by the map views (radial and subway): oriented boxes for
 * the label collision pass, text wrapping and the label metrics. No React, no DOM.
 */

export type Tone = "full" | "mid" | "dim";

/** Label metrics (px on screen at scale 1). */
export const LABEL_PX = 11;
/** Estimated advance of one uppercase label glyph (px at LABEL_PX). */
export const LABEL_CH = 7.6;
export const LABEL_LINE = 13;
/** Station centre to first glyph. */
export const LABEL_GAP = 15;
/** Other titles by level, as a multiple of the fit zoom (kFit), before the density multiplier. */
export const LABEL_MIN_REL: Record<number, number> = { 1: 1.7, 2: 2.0, 3: 2.3, 4: 1.5 };
export const WRAP_CHARS = 22;
/** Hit targets are at least this radius on screen (24px diameter). */
export const HIT_R = 24;
export const HIT_PX = 12;

export { edgeKey } from "@/lib/map/route";
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Station centre to first glyph, in screen px (clears the dot when zoomed in). */
export const labelGap = (ls: number, m: number, k: number) => Math.max(LABEL_GAP * ls, 7 * m * k + 7);

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Greedy word wrap to at most `maxLines` lines; the last line is truncated only if still too long. */
export function wrapTitle(text: string, maxChars: number, maxLines: number): string[] {
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

/** Splits a line name in at most two lines without truncating (the narrowest wrap that fits). */
export function wrapName(name: string): string[] {
  const text = name.toUpperCase();
  for (let max = 10; max < text.length; max++) {
    const lines = wrapTitle(text, max, 3);
    if (lines.length <= 2 && lines.every((l) => l.length <= max || !l.includes(" "))) return lines;
  }
  return [text];
}

/** Oriented box in screen space (u = unit direction of the long axis). */
export interface Box {
  cx: number;
  cy: number;
  ux: number;
  uy: number;
  hw: number;
  hh: number;
}

export function boxesOverlap(a: Box, b: Box, pad = 2): boolean {
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

export const aabb = (cx: number, cy: number, hw: number, hh: number): Box => ({ cx, cy, ux: 1, uy: 0, hw, hh });
