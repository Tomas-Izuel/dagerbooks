import type { Marketplace } from "@estantes/catalog";

/**
 * Todo lo propio de un creador que no es UI. Vive en apps/<creador>/creator.config.ts; los
 * paquetes lo reciben como parámetro y nunca lo importan.
 */
export interface CreatorConfig {
  /** Slug de la app (carpeta en apps/ y namespace de localStorage). */
  id: string;
  /** Nombre del creador, tal como se lo nombra en los textos. */
  name: string;
  /** Una frase de quién es (la usan los prompts de extracción). */
  bio?: string;
  /**
   * Estándar de fidelidad del sitio: qué hace falta para que una recomendación entre y cómo se cita.
   * Lo usan los prompts de /add-books; si falta, se usa el estándar general.
   */
  standard?: string;
  site: {
    name: string;
    description: string;
    /** Locale de Open Graph. */
    locale: string;
    defaultTitle: string;
  };
  labels: {
    /** Textos de cada nivel de recomendación que use la app. */
    recommendation: Record<string, { label: string; description: string }>;
    level: Record<number, string>;
    routeKind: Record<"corriente" | "objetivo", string>;
  };
  copy: {
    /** Descripción de un libro sin summary, para metadata. */
    bookDescriptionFallback: (title: string, levelLabel: string) => string;
  };
  affiliate: { tag: string; marketplace: Marketplace } | null;
  brand: { official: boolean; assets: "none" | "provided" };
  /** Prefijo de las claves de localStorage. Cambiarlo borra el progreso de los lectores. */
  storageNamespace: string;
  modules: { progression: boolean; routes: boolean; updates: boolean };
  voice: { language: "es" | "en"; variant: string };
  /** Dónde recomienda libros: lo usa el pipeline de ingesta y el formulario de sugerencias. */
  channels: Array<{ kind: "youtube" | "twitch" | "instagram" | "tiktok" | "podcast" | "reddit" | "github"; handle: string; url: string }>;
}

/** Identidad: devuelve la config con sus tipos literales (módulos, niveles) intactos. */
export const defineCreator = <const T extends CreatorConfig>(config: T): T => config;
