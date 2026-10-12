"use client";

import { useCallback, useSyncExternalStore } from "react";
import { storageKey } from "./storage";

/** Última novedad vista en `<namespace>:update-seen:v1`. Llamar una vez por app, a nivel de módulo. */
export function createSeenUpdate(namespace: string) {
  const key = storageKey(namespace, "update-seen", 1);
  // localStorage con respaldo en memoria.
  let memory: string | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function readStored(): string | null {
    try {
      return window.localStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  }

  function subscribe(cb: () => void) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  }

  /**
   * ¿Ya se vio la actualización `latestId`? En servidor y en el render de hidratación devuelve true
   * (el aviso queda oculto, sin parpadeo); tras montar, React aplica lo guardado y el aviso aparece
   * solo si falta verlo. Si localStorage falla, se muestra igual y "cerrar" dura hasta recargar.
   */
  function useSeenUpdate(latestId: string): { seen: boolean; markSeen: () => void } {
    const stored = useSyncExternalStore(subscribe, readStored, () => latestId);
    const markSeen = useCallback(() => {
      memory = latestId;
      try {
        window.localStorage.setItem(key, latestId);
      } catch {
        /* sin almacenamiento: queda cerrado hasta recargar */
      }
      emit();
    }, [latestId]);
    return { seen: stored === latestId, markSeen };
  }

  return { key, useSeenUpdate };
}
