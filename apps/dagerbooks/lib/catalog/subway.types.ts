/**
 * Contrato del layout de la vista Subte. Solo tipos: sin React, sin Node, sin Zod.
 * El `Layout` radial no se generaliza (es polar por construcción); el subte tiene el suyo.
 * Reusa `LayoutBounds` y `LayoutEdge` (con `pts` y `mid`, que el radial no llena).
 */
import type { LayoutBounds, LayoutEdge } from "./layout.types";
import type { LayoutBook } from "./layout";

export type SubwayRecommendation = "fuerte" | "interesante" | "mencion";

/** Lo que necesita el layout: `LayoutBook` más `recommendation` y `title` (ambos opcionales, solo ordenan el riel). */
export interface SubwayBook extends LayoutBook {
  title?: string;
  recommendation?: SubwayRecommendation;
  /** "Acá arrancás" de su línea. Si falta, vale: Km 0 lo lista en `leadsTo`. */
  entry?: boolean;
}

export interface SubwayCatalog {
  books: readonly SubwayBook[];
  topics: readonly { id: string }[];
}

export interface SubwayLayoutConfig {
  /** Distancia vertical entre carriles. */
  lanePitch: number;
  /** Distancia entre subcolumnas del riel de cabecera. */
  colPitch: number;
  /** Mínimo horizontal entre columnas de zona. */
  zoneGapMin: number;
  /** Tramo recto entre el fin de la diagonal y la estación. */
  forkMargin: number;
  bandGap: number;
  pillWidth: number;
  /** Ancho a la izquierda de la píldora (disco + nombre). */
  headerWidth: number;
  zoneHeaderHeight: number;
  /** Filas de riel de cabecera por lado; el resto va a subcolumnas dentro de la zona 1. */
  maxRailRows: number;
  nodeRadius: number;
  trackCorner: number;
  precision: number;
}

export type SubwayRole = "root" | "spine" | "branch" | "rail" | "island";
export type SubwayLabelSlot = "ne" | "se" | "nw" | "sw";

export interface SubwayNode {
  id: string;
  x: number;
  y: number;
  /** 0-4. La zona de la estación es su nivel. */
  level: number;
  /** Línea primaria; null en Km 0. */
  sector: string | null;
  /** Índice de banda (-1 en Km 0). */
  band: number;
  /** Relativo al carril troncal (0); negativo = arriba. */
  lane: number;
  /** Subcolumna dentro de la zona (0 salvo en el riel de cabecera). */
  sub: number;
  role: SubwayRole;
  labelSlot: SubwayLabelSlot;
  /** Orden global por y y luego x, para el teclado. */
  rank: number;
}

export interface SubwayBand {
  topicId: string;
  index: number;
  /** Extensión vertical. */
  y0: number;
  y1: number;
  spineY: number;
  startX: number;
  endX: number;
  /** Estación "Acá arrancás" de la línea (la que cuelga explícitamente de Km 0). */
  entryId: string | null;
  count: number;
}

export interface SubwayZone {
  /** 1-4. */
  level: number;
  /** Columna principal de estaciones (igual en todas las bandas). */
  x: number;
  /** Extensión: incluye el hueco de entrada (diagonales) y las subcolumnas del riel. */
  x0: number;
  x1: number;
}

export interface SubwayCrossings {
  /** Cruces vía contra vía entre tramos del árbol (debe ser 0). */
  tree: number;
  /** Cruces que involucran una arista secundaria (más de un padre). */
  secondary: number;
}

export interface SubwayLayout {
  /** Orden del catálogo. */
  nodes: SubwayNode[];
  /** Orden: leadsTo por libro, implicitRoot, related. Con `pts` y `mid`. */
  edges: LayoutEdge[];
  bands: SubwayBand[];
  zones: SubwayZone[];
  /**
   * Km 0: la estación larga. En el mapa completo va de la primera a la última banda;
   * `y0 === y1` cuando solo hay un carril (el render la dibuja circular).
   * Todas las vías de Km 0 arrancan en `x` sobre la píldora, a la altura de su fila.
   */
  pill: { x: number; y0: number; y1: number; width: number };
  bounds: LayoutBounds;
  minNodeDistance: number;
  crossings: SubwayCrossings;
  config: SubwayLayoutConfig;
}

export interface SubwayFocusLayout {
  topicId: string;
  layout: SubwayLayout;
  /** Estaciones del foco (sin Km 0). */
  count: number;
  /** Combinaciones con otras líneas, por estación (mismo significado que `FocusLayout.links`). */
  links: ReadonlyMap<string, readonly string[]>;
}
