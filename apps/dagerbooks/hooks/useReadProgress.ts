"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const READ_STORAGE_KEY = "dagerbooks:read:v1";

// Store de módulo: localStorage con respaldo en memoria si no está disponible.
// El snapshot es un string JSON (primitivo, estable) para useSyncExternalStore.
const EMPTY = "[]";
let memory = EMPTY;
let persistedFlag = true;
let initialized = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readRaw(): string {
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    persistedFlag = true;
    return raw ?? EMPTY;
  } catch {
    persistedFlag = false;
    return memory;
  }
}

function getSnapshot(): string {
  if (!initialized) {
    initialized = true;
    memory = readRaw();
  }
  return memory;
}

function write(ids: Iterable<string>) {
  memory = JSON.stringify([...ids]);
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, memory);
    persistedFlag = true;
  } catch {
    persistedFlag = false;
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== READ_STORAGE_KEY) return;
    const next = readRaw();
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

const parse = (raw: string): Set<string> => {
  try {
    const v: unknown = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
};

const noopSubscribe = () => () => {};

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

export function useReadProgress(): ReadProgress {
  // Servidor y render de hidratación usan EMPTY; luego React re-renderiza con el valor real.
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const persisted = useSyncExternalStore(subscribe, () => persistedFlag, () => true);
  const read = useMemo(() => parse(raw), [raw]);

  const toggle = useCallback((id: string) => {
    const next = parse(getSnapshot());
    if (!next.delete(id)) next.add(id);
    write(next);
  }, []);
  const clear = useCallback(() => write([]), []);
  const isRead = useCallback((id: string) => read.has(id), [read]);

  return useMemo(
    () => ({ read, isRead, toggle, clear, count: read.size, persisted, hydrated }),
    [read, isRead, toggle, clear, persisted, hydrated],
  );
}
