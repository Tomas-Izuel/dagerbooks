/**
 * Claves de localStorage: `<namespace>:<nombre>:v<versión>`. El namespace sale de la config del
 * creador; cambiar cualquiera de las tres partes deja a los lectores sin su estado guardado.
 */
export const storageKey = (namespace: string, name: string, version: number) => `${namespace}:${name}:v${version}`;

/**
 * Store de módulo sobre una clave de localStorage, con respaldo en memoria si no está disponible.
 * El snapshot es un string JSON (primitivo, estable) para useSyncExternalStore.
 */
export function createJsonStore(key: string, empty: string) {
  let memory = empty;
  let persistedFlag = true;
  let initialized = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function readRaw(): string {
    try {
      const raw = window.localStorage.getItem(key);
      persistedFlag = true;
      return raw ?? empty;
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

  function write(value: string) {
    memory = value;
    try {
      window.localStorage.setItem(key, memory);
      persistedFlag = true;
    } catch {
      persistedFlag = false;
    }
    emit();
  }

  function subscribe(cb: () => void) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== key) return;
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

  return { key, empty, getSnapshot, write, subscribe, persisted: () => persistedFlag };
}

export const noopSubscribe = () => () => {};

/** Lista de strings sin repetidos; tolera JSON roto o valores de otro tipo. */
export const parseIdList = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : [];
  } catch {
    return [];
  }
};
