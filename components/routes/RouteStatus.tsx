"use client";

import { Dotted } from "@/components/page/Dotted";
import { useMemo } from "react";
import { useFollowedRoutes } from "@/hooks/useFollowedRoutes";
import { useReadProgress } from "@/hooks/useReadProgress";
import { detoursLabel, routeProgress, type RouteSummary } from "@/lib/routes/progress";
import styles from "./RouteStatus.module.css";

/** "Siguiendo · 2 de 7" si seguís la ruta; nada (y sin hueco) si no, o antes de montar. */
export function RouteStatus({ route, knownIds }: { route: RouteSummary; knownIds: string[] }) {
  const ids = useMemo(() => knownIds, [knownIds]);
  const { isFollowing, hydrated } = useFollowedRoutes(ids);
  const progress = useReadProgress();
  if (!hydrated || !isFollowing(route.id)) return null;
  const p = routeProgress(route.steps, progress.read);
  const next = p.next >= 0 ? route.steps[p.next] : null;
  return (
    <p className={styles.status}>
      <span className={styles.badge}>Siguiendo</span>
      <span>
        <Dotted parts={[`${p.done} de ${p.total}`, detoursLabel(p), next ? `Próxima: ${next.title}` : "Llegaste"]} />
      </span>
    </p>
  );
}
