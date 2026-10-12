"use client";

import { Dotted } from "@/components/page/Dotted";
import Link from "next/link";
import type { CSSProperties } from "react";
import { LineDisc } from "@/components/ui/LineDisc";
import { ROUTE_KIND_LABELS } from "@/lib/catalog/schema";
import type { RouteSummary } from "@/lib/routes/progress";
import styles from "./RouteBanner.module.css";

interface RouteBannerProps {
  route: RouteSummary;
  vista: "grafo" | "subte";
  onExit(): void;
}

/** Cartel de la vista de una ruta: qué se ilumina, cómo volver a la ruta y cómo salir. */
export function RouteBanner({ route, vista, onExit }: RouteBannerProps) {
  const n = route.steps.length;
  return (
    <section className={styles.banner} data-vista={vista} aria-label={`Ruta en el mapa: ${route.name}`} style={{ "--ink": route.line.color } as CSSProperties}>
      <div className={styles.id}>
        <LineDisc letter={route.line.letter} color={route.line.color} />
        <div className={styles.text}>
          <p className={styles.name}>{route.name}</p>
          <p className={styles.meta}>
            <Dotted parts={[ROUTE_KIND_LABELS[route.kind], `${n} estaciones encendidas, el resto apagado`]} />
          </p>
        </div>
      </div>
      <div className={styles.actions}>
        <Link href={`/rutas/${route.id}`} className={styles.link}>
          Ver<span className={styles.long}> la ruta</span>
        </Link>
        <button type="button" className={styles.exit} onClick={onExit}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
          Salir<span className={styles.long}> de la ruta</span>
        </button>
      </div>
    </section>
  );
}
