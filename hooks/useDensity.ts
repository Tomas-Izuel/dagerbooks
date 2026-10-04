"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensity, type Density } from "@/lib/density";

// Store de módulo (mismo patrón que useReadProgress): localStorage con respaldo en memoria.
let memory: Density = DEFAULT_DENSITY;
let initialized = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readStored(): Density {
  try {
    const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    return isDensity(raw) ? raw : DEFAULT_DENSITY;
  } catch {
    return memory;
  }
}

function getSnapshot(): Density {
  if (!initialized) {
    initialized = true;
    memory = readStored();
  }
  return memory;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== DENSITY_STORAGE_KEY) return;
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

function write(next: Density) {
  memory = next;
  try {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
  } catch {
    /* sin almacenamiento: la preferencia vive en memoria hasta recargar */
  }
  emit();
}

const noopSubscribe = () => () => {};

export interface DensityState {
  density: Density;
  setDensity: (d: Density) => void;
  /** false en servidor y primer render; true tras montar en el cliente. */
  hydrated: boolean;
}

/** Servidor y render de hidratación devuelven "compacta"; luego React aplica el valor guardado. */
export function useDensity(): DensityState {
  const density = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_DENSITY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const setDensity = useCallback((d: Density) => write(d), []);
  return useMemo(() => ({ density, setDensity, hydrated }), [density, setDensity, hydrated]);
}
