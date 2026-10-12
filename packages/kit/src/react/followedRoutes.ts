"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createJsonStore, noopSubscribe, parseIdList, storageKey } from "./storage";

export interface FollowedRoutes {
  /** Ids seguidos, en el orden en que se empezaron a seguir; sin los que ya no existen. */
  ids: readonly string[];
  isFollowing: (id: string) => boolean;
  follow: (id: string) => void;
  unfollow: (id: string) => void;
  /** false si localStorage no está disponible (lo seguido vive solo en memoria). */
  persisted: boolean;
  /** false en servidor y primer render; true tras montar en el cliente. */
  hydrated: boolean;
}

/** Rutas seguidas en `<namespace>:routes:v1`. Llamar una vez por app, a nivel de módulo. */
export function createFollowedRoutes(namespace: string) {
  const store = createJsonStore(storageKey(namespace, "routes", 1), "[]");

  /** `knownIds`: los ids de rutas que existen hoy; los guardados que ya no existen se ignoran en silencio. */
  function useFollowedRoutes(knownIds: readonly string[]): FollowedRoutes {
    const raw = useSyncExternalStore(store.subscribe, store.getSnapshot, () => store.empty);
    const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const persisted = useSyncExternalStore(store.subscribe, store.persisted, () => true);
    const known = useMemo(() => new Set(knownIds), [knownIds]);
    const ids = useMemo(() => parseIdList(raw).filter((id) => known.has(id)), [raw, known]);

    const follow = useCallback((id: string) => {
      const cur = parseIdList(store.getSnapshot());
      if (!cur.includes(id)) store.write(JSON.stringify([...cur, id]));
    }, []);
    const unfollow = useCallback(
      (id: string) => store.write(JSON.stringify(parseIdList(store.getSnapshot()).filter((x) => x !== id))),
      [],
    );
    const isFollowing = useCallback((id: string) => ids.includes(id), [ids]);

    return useMemo(
      () => ({ ids, isFollowing, follow, unfollow, persisted, hydrated }),
      [ids, isFollowing, follow, unfollow, persisted, hydrated],
    );
  }

  return { key: store.key, useFollowedRoutes };
}
