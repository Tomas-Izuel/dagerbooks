import type { Gap } from "@/lib/catalog/schema";
import styles from "./WalkSign.module.css";

interface WalkSignProps {
  gap: Gap;
  /** "in": el tramo va de la estación anterior a esta. "out": de esta a la siguiente. */
  direction: "in" | "out";
  /** Quién queda de cada lado, para cuando el cartel no está pegado a una sola estación. */
  between?: string;
  /** Abierto al montarse (por defecto sí: los temas son lo que el lector vino a buscar). */
  defaultOpen?: boolean;
}

const SEVERITY_LABEL: Record<Gap["severity"], string> = {
  fuerte: "largo",
  "muy-fuerte": "muy largo",
};

/** Huellas: dos pisadas desfasadas, dibujadas con el mismo trazo cuadrado del resto de la señalética. */
function Footsteps() {
  return (
    <svg className={styles.icon} width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true">
      <ellipse cx="7" cy="7.5" rx="3" ry="4.4" />
      <circle cx="7" cy="14.2" r="1.5" />
      <ellipse cx="15" cy="12.5" rx="3" ry="4.4" />
      <circle cx="15" cy="19.2" r="1.5" />
    </svg>
  );
}

/**
 * Cartel de "Tramo a pie": entre dos estaciones la red de Dager no tiene paradas.
 * HTML plano (sirve en servidor y en cliente); <details> da teclado y lector de pantalla sin JS.
 * Los temas del puente son cosas para investigar, nunca recomendaciones de Dager.
 */
export function WalkSign({ gap, direction, between, defaultOpen = true }: WalkSignProps) {
  return (
    <details className={styles.sign} data-severity={gap.severity} open={defaultOpen}>
      <summary className={styles.summary}>
        <Footsteps />
        <span className={styles.name}>Tramo a pie</span>
        <span className={styles.severity}>{SEVERITY_LABEL[gap.severity]}</span>
        <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
          <path d="M2 4l4 4 4-4" />
        </svg>
      </summary>
      <div className={styles.body}>
        <p className={styles.line}>
          {between ? <span className={styles.between}>{between}. </span> : null}
          Dager no tiene libros para este pedazo: lo caminás por tu cuenta.
        </p>
        <p className={styles.lead}>{direction === "in" ? "Investigá antes:" : "Investigá antes de seguir:"}</p>
        <ul className={styles.bridge}>
          {gap.bridge.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {gap.note ? <p className={styles.note}>{gap.note}</p> : null}
      </div>
    </details>
  );
}
