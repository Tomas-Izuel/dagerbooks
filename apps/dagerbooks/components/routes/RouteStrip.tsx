import type { CSSProperties } from "react";
import type { RouteSummary } from "@/lib/routes/progress";
import styles from "./RouteStrip.module.css";

/** La ruta de un vistazo: una vía gruesa con una estación por libro (los desvíos, huecos). Decorativa. */
export function RouteStrip({ route }: { route: RouteSummary }) {
  return (
    <span className={styles.strip} aria-hidden="true" style={{ "--ink": route.line.color } as CSSProperties}>
      {route.steps.map((s) => (
        <span key={s.id} className={styles.stop} data-optional={s.optional || undefined} />
      ))}
    </span>
  );
}
