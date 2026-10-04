import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./TrackBand.module.css";

export interface Stop {
  title: string;
  href: string;
}

interface TrackBandProps {
  /** Tinta de la línea (CSS color). */
  ink: string;
  prev: Stop | null;
  here: string;
  next: Stop | null;
  /** Cuántas estaciones más hay antes / después además de la mostrada. */
  morePrev?: number;
  moreNext?: number;
  /** Texto cuando no hay anterior (cabecera) o siguiente (terminal). */
  prevFallback: string;
  nextFallback: string;
}

/** Cartel de andén: la vía de la línea a todo el ancho con la estación actual entre su anterior y su siguiente. */
export function TrackBand({ ink, prev, here, next, morePrev = 0, moreNext = 0, prevFallback, nextFallback }: TrackBandProps) {
  return (
    <div className={styles.track} style={{ "--ink": ink } as CSSProperties}>
      <div className={styles.bar} aria-hidden="true" />
      <ol className={styles.stops} aria-label="Ubicación en la línea">
        <li className={styles.stop} data-kind="prev">
          <span className={styles.ring} aria-hidden="true" />
          {prev ? (
            <>
              <span className={styles.dir}>Viene de</span>
              <Link href={prev.href}>{prev.title}</Link>
              {morePrev > 0 ? <span className={styles.more}>y {morePrev} más</span> : null}
            </>
          ) : (
            <span className={styles.end}>{prevFallback}</span>
          )}
        </li>
        <li className={styles.stop} data-kind="here" aria-current="location">
          <span className={styles.ring} aria-hidden="true" />
          <span className={styles.here}>Estás acá</span>
          <span className={styles.name}>{here}</span>
        </li>
        <li className={styles.stop} data-kind="next">
          <span className={styles.ring} aria-hidden="true" />
          {next ? (
            <>
              <span className={styles.dir}>Sigue a</span>
              <Link href={next.href}>{next.title}</Link>
              {moreNext > 0 ? <span className={styles.more}>y {moreNext} más</span> : null}
            </>
          ) : (
            <span className={styles.end}>{nextFallback}</span>
          )}
        </li>
      </ol>
    </div>
  );
}
