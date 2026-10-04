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

/**
 * Escala visual por densidad. El layout separa las estaciones; esto achica las marcas
 * (tipografía, puntos, trazos, discos) para que al encajar el mapa se note el aire y el
 * detalle quede detrás del zoom.
 */
export interface DensityScale {
  /** Multiplier on every mark: label type, dots, strokes, ticks, KM 0, zone numerals. */
  mark: number;
  /** Terminus discs shrink less so the line letters stay readable. */
  terminus: number;
  /** Labels grow with zoom: size = base * mark * clamp(k / kFit, 1, maxGrow). */
  maxGrow: number;
  /** Entry-station titles appear from this multiple of the fit zoom. */
  entryAt: number;
  /** Multiplier on the per-level "other titles" thresholds (relative to fit). */
  labelMul: number;
}

export const DENSITY_SCALE: Record<Density, DensityScale> = {
  compacta: { mark: 1, terminus: 1, maxGrow: 1, entryAt: 0.7, labelMul: 1 },
  media: { mark: 0.85, terminus: 0.93, maxGrow: 1.3, entryAt: 1, labelMul: 1.2 },
  aireada: { mark: 0.68, terminus: 0.82, maxGrow: 1.6, entryAt: 1.4, labelMul: 1.45 },
};
