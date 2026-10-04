/** Densidad de la interfaz: la comparten el mapa (layout), el CSS (data-density) y el hook. */
export const DENSITIES = ["compacta", "media", "aireada"] as const;
export type Density = (typeof DENSITIES)[number];

export const DEFAULT_DENSITY: Density = "compacta";
export const DENSITY_STORAGE_KEY = "dagerbooks:density:v1";

export const DENSITY_LABEL: Record<Density, string> = {
  compacta: "Compacta",
  media: "Media",
  aireada: "Aireada",
};

export const isDensity = (v: unknown): v is Density => typeof v === "string" && (DENSITIES as readonly string[]).includes(v);
