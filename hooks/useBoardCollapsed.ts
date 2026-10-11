"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const BOARD_COLLAPSED_KEY = "dagerbooks:board-collapsed:v1";

// Mismo patrón que useDensity: localStorage con respaldo en memoria.
let memory = false;
let initialized = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readStored(): boolean {
  try {
    return window.localStorage.getItem(BOARD_COLLAPSED_KEY) === "1";
  } catch {
    return memory;
  }
}

function getSnapshot(): boolean {
  if (!initialized) {
    initialized = true;
    memory = readStored();
  }
  return memory;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== BOARD_COLLAPSED_KEY) return;
    const next = readStored();
    if (next !== memory) {
      memory = next;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: boolean) {
  memory = next;
  try {
    window.localStorage.setItem(BOARD_COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    /* sin almacenamiento: la preferencia vive en memoria hasta recargar */
  }
  emit();
}

export interface BoardCollapsedState {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}

/** Servidor y render de hidratación devuelven "expandida"; luego React aplica el valor guardado. */
export function useBoardCollapsed(): BoardCollapsedState {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const setCollapsed = useCallback((c: boolean) => write(c), []);
  return useMemo(() => ({ collapsed, setCollapsed }), [collapsed, setCollapsed]);
}
