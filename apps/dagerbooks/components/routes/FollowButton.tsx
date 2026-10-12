"use client";

import { useMemo } from "react";
import { useFollowedRoutes } from "@/hooks/useFollowedRoutes";
import styles from "./FollowButton.module.css";

interface FollowButtonProps {
  routeId: string;
  /** Ids de todas las rutas: los guardados que ya no existen se ignoran. */
  knownIds: string[];
}

/** "Seguir esta ruta" ⇄ "Siguiendo" + "Dejar de seguir". Se guarda en este navegador, nada más. */
export function FollowButton({ routeId, knownIds }: FollowButtonProps) {
  const ids = useMemo(() => knownIds, [knownIds]);
  const { isFollowing, follow, unfollow, hydrated, persisted } = useFollowedRoutes(ids);
  const following = hydrated && isFollowing(routeId);

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {following ? (
          <>
            <p className={styles.status} role="status">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" aria-hidden="true">
                <path d="M3.5 10.5l4.5 4.5 8.5-9.5" />
              </svg>
              Siguiendo
            </p>
            <button type="button" className={styles.quiet} onClick={() => unfollow(routeId)}>
              Dejar de seguir
            </button>
          </>
        ) : (
          <button type="button" className={styles.primary} disabled={!hydrated} onClick={() => follow(routeId)}>
            Seguir esta ruta
          </button>
        )}
      </div>
      {hydrated && !persisted ? (
        <p className={styles.note}>Este navegador no deja guardar datos: la ruta se recuerda hasta que recargues.</p>
      ) : null}
    </div>
  );
}
