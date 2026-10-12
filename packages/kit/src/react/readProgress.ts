"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createJsonStore, noopSubscribe, parseIdList, storageKey } from "./storage";

export interface ReadProgress {
  read: ReadonlySet<string>;
  isRead: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  count: number;
  /** false si localStorage no está disponible (el estado vive solo en memoria). */
  persisted: boolean;
  /** false en servidor y primer render; true tras montar en el cliente. */
  hydrated: boolean;
}

/** "Lo leí": ids leídos en `<namespace>:read:v1`. Llamar una vez por app, a nivel de módulo. */
export function createReadProgress(namespace: string) {
  const store = createJsonStore(storageKey(namespace, "read", 1), "[]");
  const parse = (raw: string) => new Set(parseIdList(raw));

  function useReadProgress(): ReadProgress {
    // Servidor y render de hidratación usan el vacío; luego React re-renderiza con el valor real.
    const raw = useSyncExternalStore(store.subscribe, store.getSnapshot, () => store.empty);
    const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const persisted = useSyncExternalStore(store.subscribe, store.persisted, () => true);
    const read = useMemo(() => parse(raw), [raw]);

    const toggle = useCallback((id: string) => {
      const next = parse(store.getSnapshot());
      if (!next.delete(id)) next.add(id);
      store.write(JSON.stringify([...next]));
    }, []);
    const clear = useCallback(() => store.write("[]"), []);
    const isRead = useCallback((id: string) => read.has(id), [read]);

    return useMemo(
      () => ({ read, isRead, toggle, clear, count: read.size, persisted, hydrated }),
      [read, isRead, toggle, clear, persisted, hydrated],
    );
  }

  return { key: store.key, useReadProgress };
}
