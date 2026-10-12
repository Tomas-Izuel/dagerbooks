import type { Recommendation } from "@/lib/catalog/schema";
import { REC_DOT } from "@/lib/design/recommendation";

/**
 * The map's station for each recommendation level, as a small sign glyph.
 * Same radii and strokes as the map (lib/design/recommendation.ts), so the code reads the same everywhere.
 * Decorative: always paired with the level's text.
 */
export function RecMark({ level, size = 18 }: { level: Recommendation; size?: number }) {
  const d = REC_DOT[level];
  return (
    <svg width={size} height={size} viewBox="-11 -11 22 22" fill="none" aria-hidden="true" focusable="false" style={{ flex: "none" }}>
      <circle r={d.r} stroke={d.muted ? "var(--fg-muted)" : "currentColor"} strokeWidth={d.stroke} fill="var(--bg)" />
    </svg>
  );
}
