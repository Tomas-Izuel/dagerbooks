import type { LayoutEdge } from "@/lib/catalog/layout.types";
import styles from "../NetworkMap.module.css";
import { edgeKey, truncate } from "./geometry";

export interface XTag {
  key: string;
  x: number;
  y: number;
  w: number;
  reason: string;
  full: string;
}

export const XTAG_H = 36;
/** Signage plates stay readable even in airy modes. */
export const TAG_MIN_SCALE = 0.85;
const XTAG_REASON_MAX = 40;

/** Midpoint (t = 0.5) of the quadratic `M ax ay Q cx cy bx by` that the radial layout emits for related edges. */
export function quadraticMidpoint(path: string): { x: number; y: number } | null {
  const n = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!n || n.length < 6) return null;
  return { x: 0.25 * n[0] + 0.5 * n[2] + 0.25 * n[4], y: 0.25 * n[1] + 0.5 * n[3] + 0.25 * n[5] };
}

/**
 * Tag candidates for the interchanges of `focusId` (the hovered station, else the selected one).
 * `anchor` says where each tag goes: the radial view uses the curve midpoint, the subway view `edge.mid`.
 */
export function buildXTags(
  edges: readonly LayoutEdge[],
  focusId: string | null,
  anchor: (e: LayoutEdge) => { x: number; y: number } | null | undefined,
): XTag[] {
  if (!focusId) return [];
  const out: XTag[] = [];
  for (const e of edges) {
    if (e.kind !== "related" || (e.from !== focusId && e.to !== focusId)) continue;
    const mid = anchor(e);
    if (!mid) continue;
    const full = e.reason?.trim() ?? "";
    const reason = truncate(full, XTAG_REASON_MAX);
    out.push({ key: edgeKey(e), x: mid.x, y: mid.y, w: Math.max(122, 44 + reason.length * 5.8), reason, full });
  }
  return out;
}

/** Signage tag at the midpoint of an interchange: glyph, COMBINACIÓN, and the reason. Counter-scaled. */
export function InterchangeTags({ tags, k, scale }: { tags: readonly XTag[]; k: number; scale: number }) {
  return (
    <g aria-hidden="true">
      {tags.map((t) => (
        <g
          key={t.key}
          className={styles.xTag}
          transform={`translate(${t.x.toFixed(1)} ${t.y.toFixed(1)}) scale(${(scale / k).toFixed(4)})`}
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
