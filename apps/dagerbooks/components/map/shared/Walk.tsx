import type { CSSProperties } from "react";
import type { LayoutEdge } from "@/lib/catalog/layout.types";
import type { GapSeverity } from "@/lib/catalog/schema";
import { edgeKey, type Tone } from "./geometry";
import styles from "./Walk.module.css";

/** Tramos a pie por arista (`from>to`): los dibujan igual el mapa radial y el subte. */
export type GapMap = ReadonlyMap<string, GapSeverity>;

export function gapsFromEdges(edges: readonly { from: string; to: string; gap?: GapSeverity }[]): GapMap {
  return new Map(edges.filter((e) => e.gap).map((e) => [edgeKey(e), e.gap!]));
}

/** Estado de reposo: la tinta se corta a mitad de camino y las huellas de porcelana cruzan el hueco. */
export function WalkTrack({ edge, gap, tone, ink }: { edge: LayoutEdge; gap: GapSeverity; tone: Tone; ink: string }) {
  return (
    <g>
      <path className={styles.trace} data-tone={tone} data-gap={gap} d={edge.path} />
      <path
        className={styles.stubs}
        data-tone={tone}
        data-gap={gap}
        d={edge.path}
        pathLength={1}
        style={{ "--ink": ink } as CSSProperties}
      />
    </g>
  );
}

/**
 * El tramo dentro del recorrido seleccionado: se cruza a pie. Un barrido enmascarado avanza de a
 * pasos (no de corrido, como el tren), así tintas y huellas aparecen paso a paso.
 */
export function WalkRun({
  edge,
  gap,
  ink,
  index,
  n,
  bounds,
  scope,
}: {
  edge: LayoutEdge;
  gap: GapSeverity;
  ink: string;
  index: number;
  n: number;
  /** Prefijo del id de la máscara: las dos vistas pueden estar montadas a la vez durante el fundido. */
  scope: string;
  bounds: { minX: number; minY: number; width: number; height: number };
}) {
  const maskId = `walk-${scope}-${index}-${edge.from}-${edge.to}`;
  const vars = { "--ink": ink, "--i": index, "--n": n } as CSSProperties;
  return (
    <g style={vars}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x={bounds.minX - 40} y={bounds.minY - 40} width={bounds.width + 80} height={bounds.height + 80}>
        <path className={styles.wipe} d={edge.path} pathLength={1} />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path className={styles.traceRun} data-gap={gap} d={edge.path} />
        <path className={styles.stubsRun} data-gap={gap} d={edge.path} pathLength={1} />
      </g>
    </g>
  );
}
