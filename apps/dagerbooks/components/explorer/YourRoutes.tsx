"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { LineDisc } from "@/components/ui/LineDisc";
import { ArrowIcon } from "@/components/page/ArrowIcon";
import { useFollowedRoutes } from "@/hooks/useFollowedRoutes";
import { useReadProgress } from "@/hooks/useReadProgress";
import { detoursLabel, routeProgress, type RouteSummary } from "@/lib/routes/progress";
import styles from "./YourRoutes.module.css";

/**
 * "Tus rutas": una fila por cada ruta que seguís, con tu avance y la próxima parada.
 * Sin ninguna, una invitación. Vive fuera de lo que oculta la cartelera colapsada.
 * Antes de montar (servidor y primer render) reserva el lugar sin contenido: lo guardado
 * solo existe en el navegador, así que no hay nada que pueda no coincidir.
 */
export function YourRoutes({ routes }: { routes: RouteSummary[] }) {
  const knownIds = useMemo(() => routes.map((r) => r.id), [routes]);
  const followed = useFollowedRoutes(knownIds);
  const progress = useReadProgress();
  const byId = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);
  const rows = followed.ids.map((id) => byId.get(id)).filter((r): r is RouteSummary => !!r);

  if (routes.length === 0) return null;

  return (
    <section className={styles.block} aria-labelledby="tus-rutas" data-ready={followed.hydrated ? "" : undefined}>
      {!followed.hydrated ? null : rows.length === 0 ? (
        <div className={styles.invite}>
          <h2 id="tus-rutas" className={styles.invitePrompt}>
            ¿No sabés por dónde arrancar?
          </h2>
          <Link href="/rutas" className={styles.inviteLink}>
            <span>Rutas</span>
            <ArrowIcon />
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.head}>
            <h2 id="tus-rutas" className={styles.title}>
              Tus rutas
            </h2>
            <Link href="/rutas" className={styles.all}>
              Todas
            </Link>
          </div>
          <ul className={styles.list}>
            {rows.map((r) => {
              const p = routeProgress(r.steps, progress.read);
              const next = p.next >= 0 ? r.steps[p.next] : null;
              return (
                <li key={r.id}>
                  <Link href={`/rutas/${r.id}`} className={styles.row} style={{ "--ink": r.line.color } as CSSProperties}>
                    <LineDisc letter={r.line.letter} color={r.line.color} size="sm" />
                    <span className={styles.text}>
                      <span className={styles.name}>
                        {r.name}
                        <span className={styles.count}>
                          {p.done} de {p.total}
                        </span>
                      </span>
                      <span className={styles.next}>
                        <span className={styles.nextText}>{next ? <>Próxima: {next.title}</> : <>Llegaste. Fin de línea</>}</span>
                        {detoursLabel(p) ? <span className={styles.detours}>{detoursLabel(p)}</span> : null}
                      </span>
                    </span>
                    <ArrowIcon />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
