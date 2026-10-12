import Link from "next/link";
import type { CSSProperties } from "react";
import { LineDisc } from "@/components/ui/LineDisc";
import type { Gap } from "@/lib/catalog/schema";
import { WalkSign } from "./WalkSign";
import styles from "./RouteDiagram.module.css";

export interface RouteStation {
  id: string;
  title: string;
  href: string;
  /** Línea primaria del libro; null para el Kilómetro 0. */
  line: { letter: string; color: string; name: string } | null;
  /** Tramo a pie entre esta estación y la actual (si lo hay). */
  gap?: Gap;
}

interface RouteDiagramProps {
  ink: string;
  before: RouteStation[];
  here: string;
  after: RouteStation[];
}

/** El tramo a pie corta el riel: tapa la tinta y deja un trazo punteado de porcelana. */
function Walk({ gap, direction, between }: { gap: Gap; direction: "in" | "out"; between: string }) {
  return (
    <div className={styles.walk}>
      <WalkSign gap={gap} direction={direction} between={between} />
    </div>
  );
}

function Station({ s, direction, here }: { s: RouteStation; direction: "in" | "out"; here: string }) {
  const between = direction === "in" ? `Entre ${s.title} y ${here}` : `Entre ${here} y ${s.title}`;
  return (
    <li className={styles.item}>
      {direction === "out" && s.gap ? <Walk gap={s.gap} direction="out" between={between} /> : null}
      <div className={styles.row}>
        <span className={styles.ring} aria-hidden="true" />
        <Link href={s.href}>{s.title}</Link>
        {s.line ? <LineDisc letter={s.line.letter} color={s.line.color} size="sm" label={`Línea ${s.line.letter}, ${s.line.name}`} /> : <span className={styles.km}>Km 0</span>}
      </div>
      {direction === "in" && s.gap ? <Walk gap={s.gap} direction="in" between={between} /> : null}
    </li>
  );
}

/** Mini diagrama de línea: lo que se lee antes, la estación actual y lo que desbloquea. */
export function RouteDiagram({ ink, before, here, after }: RouteDiagramProps) {
  return (
    <div className={styles.route} style={{ "--ink": ink } as CSSProperties}>
      {before.length ? (
        <>
          <h3 className={styles.cap}>Antes</h3>
          <ol className={styles.list}>
            {before.map((s) => (
              <Station key={s.id} s={s} direction="in" here={here} />
            ))}
          </ol>
        </>
      ) : null}
      <p className={styles.here} aria-current="location">
        <span className={styles.ring} aria-hidden="true" />
        <span>
          <strong>Estás acá</strong> {here}
        </span>
      </p>
      {after.length ? (
        <>
          <h3 className={styles.cap}>Después</h3>
          <ol className={styles.list}>
            {after.map((s) => (
              <Station key={s.id} s={s} direction="out" here={here} />
            ))}
          </ol>
        </>
      ) : (
        <p className={styles.terminal}>Terminal: de acá no sale ninguna otra lectura (por ahora).</p>
      )}
    </div>
  );
}
