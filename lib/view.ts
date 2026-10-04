/** Vista del mapa: la elige el lector y viaja en la URL (`?vista=subte`). `grafo` es el default y se omite. */
export const VISTAS = ["grafo", "subte"] as const;
export type Vista = (typeof VISTAS)[number];

export const DEFAULT_VISTA: Vista = "grafo";

export const VISTA_LABEL: Record<Vista, string> = {
  grafo: "Grafo",
  subte: "Subte",
};

export const isVista = (v: unknown): v is Vista => typeof v === "string" && (VISTAS as readonly string[]).includes(v);

export const parseVista = (v: string | null): Vista => (isVista(v) ? v : DEFAULT_VISTA);
