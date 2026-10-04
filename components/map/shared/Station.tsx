import { memo, type CSSProperties, type FocusEvent } from "react";
import { REC_DOT } from "@/lib/design/recommendation";
import type { MapNode } from "../types";
import styles from "../NetworkMap.module.css";
import { deg, type Tone } from "./geometry";

/** Another line a station combines with (focus mode: the line itself is not drawn). */
export interface CrossMark {
  letter: string;
  color: string;
}

export interface StationProps {
  node: MapNode;
  color: string;
  tone: Tone;
  /** Not part of the line in focus: fades out in place. */
  out: boolean;
  cross: readonly CrossMark[] | undefined;
  read: boolean;
  selected: boolean;
  interchange: boolean;
  /** A faint permanent ring for a station that combines with another line (subway view); the full ring wins. */
  interchangeFaint?: boolean;
  m: number;
  hitR: number;
  tabIndex: 0 | -1;
  ariaLabel: string;
  /**
   * Where the line discs of `cross` sit. "tangent" (radial default): to the side of the mark, along the ring.
   * "above": over the mark, in a row; used by the horizontal subway tracks so they never cover the track.
   */
  crossAt?: "tangent" | "above";
  onPick(id: string): void;
  onHover(id: string | null): void;
  onFocusId(id: string, e: FocusEvent<Element>): void;
}

export const Station = memo(function Station({
  node,
  color,
  tone,
  out,
  cross,
  read,
  selected,
  interchange,
  interchangeFaint = false,
  m,
  hitR,
  tabIndex,
  ariaLabel,
  crossAt = "tangent",
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
      data-out={out ? "true" : undefined}
      data-read={read ? "true" : undefined}
      data-root={isRoot ? "true" : undefined}
      role="button"
      tabIndex={out ? -1 : tabIndex}
      aria-pressed={selected}
      aria-label={ariaLabel}
      aria-hidden={out ? true : undefined}
      // CSS (not the attribute) so the move between the full map and a line can transition.
      style={{ "--ink": color, transform: `translate(${node.x}px, ${node.y}px)` } as CSSProperties}
      onClick={() => onPick(node.id)}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={(e) => {
        onFocusId(node.id, e);
        onHover(node.id);
      }}
      onBlur={() => onHover(null)}
    >
      <circle className={styles.hit} r={isRoot ? Math.max(44, hitR) : hitR} />
      <circle className={styles.focusRing} r={(isRoot ? 36 : 17) * m} />
      {isRoot ? (
        <>
          <circle className={styles.rootOuter} r={24 * m} />
          <circle className={styles.rootInner} r={13 * m} />
        </>
      ) : (
        <>
          {node.entry ? (
            <rect
              className={styles.tick}
              x={-3.5 * m}
              y={-14 * m}
              width={7 * m}
              height={28 * m}
              transform={`rotate(${deg(node.angle).toFixed(1)})`}
            />
          ) : null}
          {interchange ? (
            <circle className={styles.interchange} r={14 * m} />
          ) : interchangeFaint ? (
            <circle className={styles.interchange} data-faint="true" r={14 * m} />
          ) : null}
          {selected ? <circle className={styles.selectedRing} r={17 * m} /> : null}
          <circle
            className={styles.dot}
            data-rec={node.recommendation}
            r={REC_DOT[node.recommendation].r * m}
          />
          {node.incomplete ? <path className={styles.notch} d="M6 -14 L15 -14 L15 -5 Z" transform={`scale(${m})`} /> : null}
          {cross?.length && crossAt === "tangent" ? (
            // Tangential to the ring, on the clockwise side; the group grows when zoomed out so the discs stay legible.
            <g transform={`rotate(${deg(node.angle).toFixed(1)})`}>
              <g className={styles.cross} style={{ "--cx": 17 * m } as CSSProperties}>
                {cross.slice(0, 3).map((c, i) => (
                  <g key={c.letter} transform={`translate(0 ${(i * 11 * m).toFixed(1)}) rotate(${(-deg(node.angle)).toFixed(1)})`}>
                    <circle className={styles.crossDisc} r={5.6 * m} style={{ "--ink": c.color } as CSSProperties} />
                    <text className={styles.crossLetter} fontSize={7.2 * m}>
                      {c.letter}
                    </text>
                  </g>
                ))}
              </g>
            </g>
          ) : null}
          {cross?.length && crossAt === "above" ? (
            <g className={styles.crossAbove} style={{ "--cx": 17 * m } as CSSProperties}>
              {cross.slice(0, 3).map((c, i, all) => (
                <g key={c.letter} transform={`translate(${((i - (all.length - 1) / 2) * 11 * m).toFixed(1)} 0)`}>
                  <circle className={styles.crossDisc} r={5.6 * m} style={{ "--ink": c.color } as CSSProperties} />
                  <text className={styles.crossLetter} fontSize={7.2 * m}>
                    {c.letter}
                  </text>
                </g>
              ))}
            </g>
          ) : null}
        </>
      )}
    </g>
  );
});
