"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const ROUTES_STORAGE_KEY = "dagerbooks:routes:v1";

// Mismo patrón que useReadProgress: localStorage con respaldo en memoria; el snapshot es un string JSON.
const EMPTY = "[]";
let memory = EMPTY;
let persistedFlag = true;
let initialized = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readRaw(): string {
  try {
    const raw = window.localStorage.getItem(ROUTES_STORAGE_KEY);
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

function write(ids: string[]) {
  memory = JSON.stringify(ids);
  try {
    window.localStorage.setItem(ROUTES_STORAGE_KEY, memory);
    persistedFlag = true;
  } catch {
    persistedFlag = false;
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== ROUTES_STORAGE_KEY) return;
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

const parse = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : [];
  } catch {
    return [];
  }
};

const noopSubscribe = () => () => {};

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

/** `knownIds`: los ids de rutas que existen hoy; los guardados que ya no existen se ignoran en silencio. */
export function useFollowedRoutes(knownIds: readonly string[]): FollowedRoutes {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const persisted = useSyncExternalStore(subscribe, () => persistedFlag, () => true);
  const known = useMemo(() => new Set(knownIds), [knownIds]);
  const ids = useMemo(() => parse(raw).filter((id) => known.has(id)), [raw, known]);

  const follow = useCallback((id: string) => {
    const cur = parse(getSnapshot());
    if (!cur.includes(id)) write([...cur, id]);
  }, []);
  const unfollow = useCallback((id: string) => write(parse(getSnapshot()).filter((x) => x !== id)), []);
  const isFollowing = useCallback((id: string) => ids.includes(id), [ids]);

  return useMemo(
    () => ({ ids, isFollowing, follow, unfollow, persisted, hydrated }),
    [ids, isFollowing, follow, unfollow, persisted, hydrated],
  );
}
