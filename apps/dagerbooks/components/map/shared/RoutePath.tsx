import type { CSSProperties } from "react";
import styles from "./RoutePath.module.css";

export interface RouteTrace {
  /** Estaciones de la ruta, en orden de lectura. */
  ids: readonly string[];
  /** Tinta de la ruta (CSS color). */
  ink: string;
  /** Ids de los pasos que tienen un tramo a pie antes: ese tramo va punteado, sin tinta. */
  gapBefore: ReadonlySet<string>;
  /** Desvíos optativos: quedan fuera de la vía y salen como ramal fino desde la parada anterior de la vía. */
  optional: ReadonlySet<string>;
}

/**
 * El recorrido de una ruta sobre el mapa atenuado: una vía en la tinta de la ruta de estación a estación,
 * en orden de lectura. Se dibuja de a tramos (como el recorrido de una selección); sin animación con reduced-motion.
 */
export function RoutePath({ trace, nodeById }: { trace: RouteTrace; nodeById: ReadonlyMap<string, { x: number; y: number }> }) {
  const pts = trace.ids.flatMap((id) => {
    const n = nodeById.get(id);
    return n ? [{ id, x: n.x, y: n.y }] : [];
  });
  const main = pts.filter((p) => !trace.optional.has(p.id));
  const segments = main.slice(1).map((to, i) => ({ from: main[i], to, gap: trace.gapBefore.has(to.id) }));
  // Cada desvío cuelga de la última parada de la vía que lo precede (o de la primera, si no hay ninguna antes).
  const spurs = pts.flatMap((p, i) => {
    if (!trace.optional.has(p.id)) return [];
    const from = pts.slice(0, i).findLast((q) => !trace.optional.has(q.id)) ?? main[0];
    return from && from.id !== p.id ? [{ from, to: p }] : [];
  });
  if (segments.length === 0 && spurs.length === 0) return null;
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  return (
    <g className={styles.path} aria-hidden="true" style={{ "--ink": trace.ink } as CSSProperties}>
      {spurs.map(({ from, to }) => (
        <path key={`spur-${to.id}`} className={styles.spur} d={line(from, to)} />
      ))}
      {segments.map(({ from, to, gap }, i) => {
        const d = line(from, to);
        const vars = { "--i": i, "--n": segments.length } as CSSProperties;
        return gap ? (
          <path key={to.id} className={styles.walk} d={d} style={vars} />
        ) : (
          <g key={to.id} style={vars}>
            <path className={styles.halo} d={d} pathLength={1} />
            <path className={styles.ink} d={d} pathLength={1} />
          </g>
        );
      })}
    </g>
  );
}
