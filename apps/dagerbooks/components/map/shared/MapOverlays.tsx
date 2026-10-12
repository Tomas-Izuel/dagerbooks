import type { CSSProperties, ReactNode } from "react";
import { LineDisc } from "@/components/ui/LineDisc";
import { RecMark } from "@/components/ui/RecMark";
import type { Recommendation } from "@/lib/catalog/schema";
import { REC_ORDER } from "@/lib/design/recommendation";
import { ZONE_NAMES, type MapLine } from "../types";
import styles from "../NetworkMap.module.css";
import type { CrossMark } from "./Station";

/** HTML chrome over the svg that both map views share. */

/** Which line is in focus, and the way out (top-left of the map). */
export function FocusBar({
  line,
  count,
  parked,
  onExit,
}: {
  line: MapLine;
  count: number;
  /** The station panel is open: leave room for the density control. */
  parked: boolean;
  onExit(): void;
}) {
  return (
    <div className={styles.focusBar} data-parked={parked ? "true" : undefined} style={{ "--ink": line.color } as CSSProperties}>
      <LineDisc letter={line.letter} color={line.color} size="sm" />
      <span className={styles.focusText}>
        <span className={styles.focusName}>{line.name}</span>
        <span className={styles.focusCount}>{count} estaciones</span>
      </span>
      <button type="button" className={styles.focusExit} onClick={onExit}>
        <span className={styles.focusExitLong}>Ver </span>todo el mapa
        <span aria-hidden="true"> ×</span>
      </button>
    </div>
  );
}

/** Signage tag above the hovered station; `left` / `top` are screen px inside the map. */
export function HoverTag({
  title,
  titleEs,
  level,
  line,
  cross,
  left,
  top,
}: {
  title: string;
  titleEs?: string;
  level: number;
  line: MapLine | undefined;
  cross: readonly CrossMark[] | undefined;
  left: number;
  top: number;
}) {
  return (
    <div className={styles.tag} aria-hidden="true" style={{ left, top }}>
      {line ? <LineDisc letter={line.letter} color={line.color} size="sm" /> : null}
      <span className={styles.tagText}>
        <span className={styles.tagTitle}>{title}</span>
        {titleEs ? <span className={styles.tagSub}>{titleEs}</span> : null}
      </span>
      <span className={styles.tagZone}>{level === 0 ? "KM 0" : `Zona ${level}`}</span>
      {cross?.length ? (
        <span className={styles.tagCross}>
          Combina con {cross.length > 1 ? "las líneas" : "la línea"} {cross.map((c) => c.letter).join(" y ")}
        </span>
      ) : null}
    </div>
  );
}

/** Zones, recommendation levels and combinations; a view adds its own keys as `children`. */
export function MapLegend({
  recLabels,
  insetRight,
  children,
}: {
  recLabels: Record<Recommendation, { label: string; description: string }>;
  insetRight: number | undefined;
  children?: ReactNode;
}) {
  return (
    <div
      className={styles.legend}
      data-parked={insetRight ? "true" : undefined}
      tabIndex={0}
      aria-label="Leyenda del mapa"
      style={{ insetInlineEnd: `${16 + (insetRight ?? 0)}px` }}
    >
      <p className={styles.legendHead}>
        <svg className={styles.legendRing} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8" />
        </svg>
        Zonas y combinaciones
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
        <ul className={styles.legendRecs} aria-label="Recomendación de Dager">
          {REC_ORDER.map((r) => (
            <li key={r}>
              <RecMark level={r} size={18} />
              <span className={styles.legendRecText}>
                <span className={styles.legendKeyName}>{recLabels[r].label}</span>
                <span>{recLabels[r].description}</span>
              </span>
            </li>
          ))}
        </ul>
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
        {children}
      </div>
    </div>
  );
}
