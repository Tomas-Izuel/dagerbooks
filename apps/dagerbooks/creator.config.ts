/**
 * Todo lo propio de Dager que no es UI: identidad del sitio, etiquetas de los datos,
 * afiliado, módulos del catálogo y fuentes de ingesta. Los paquetes compartidos no
 * conocen nada de esto; lo reciben desde acá.
 */

export type Marketplace = "es" | "com" | "com.mx" | "co.uk" | "de" | "fr" | "it";

export interface CreatorConfig {
  /** Slug de la app (carpeta en apps/ y namespace de localStorage). */
  id: string;
  /** Nombre del creador, tal como se lo nombra en los textos. */
  name: string;
  site: {
    name: string;
    description: string;
    /** Locale de Open Graph. */
    locale: string;
    defaultTitle: string;
  };
  labels: {
    recommendation: Record<"fuerte" | "interesante" | "mencion", { label: string; description: string }>;
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
  channels: Array<{ kind: "youtube" | "twitch" | "instagram" | "reddit" | "github"; handle: string; url: string }>;
}

export const defineCreator = <const T extends CreatorConfig>(config: T): T => config;

const config = defineCreator({
  id: "dagerbooks",
  name: "Dager",
  site: {
    name: "DagerBooks",
    description: "Mapa de lecturas recomendadas por Dager, organizado por tema y nivel. Proyecto de fans, no oficial.",
    locale: "es_AR",
    defaultTitle: "DagerBooks · El mapa de lecturas de Dager",
  },
  labels: {
    recommendation: {
      fuerte: { label: "Lo súper recomienda", description: "Lectura imprescindible o favorita: insiste en que la lean." },
      interesante: { label: "Ideas interesantes", description: "Lo valora o lo recomienda con reservas; tiene ideas que le sirven." },
      mencion: { label: "Mención curiosa", description: "Lo cita o lo nombra, pero no lo recomienda." },
    },
    level: {
      0: "Raíz",
      1: "Introductorio",
      2: "Intermedio",
      3: "Avanzado",
      4: "Especialista",
    },
    routeKind: { corriente: "Corriente", objetivo: "Objetivo" },
  },
  copy: {
    bookDescriptionFallback: (title, levelLabel) => `${title}: lectura nivel ${levelLabel.toLowerCase()} recomendada por Dager.`,
  },
  // Retribución autorizada por Dager por la web.
  affiliate: { tag: "ti05ab-21", marketplace: "es" },
  // Dager autorizó el proyecto en el stream del 2026-10-11; todavía no hay assets propios.
  brand: { official: true, assets: "none" },
  storageNamespace: "dagerbooks",
  modules: { progression: true, routes: true, updates: true },
  voice: { language: "es", variant: "rioplatense (voseo, irreverente)" },
  channels: [
    { kind: "youtube", handle: "DotDager", url: "https://www.youtube.com/@DotDager" },
    { kind: "youtube", handle: "DagerClips", url: "https://www.youtube.com/@DagerClips" },
    { kind: "youtube", handle: "ElAntroDeDager", url: "https://www.youtube.com/@ElAntroDeDager" },
    { kind: "reddit", handle: "DagerDotCSV", url: "https://www.reddit.com/user/DagerDotCSV" },
    { kind: "github", handle: "MarianoVilla", url: "https://github.com/MarianoVilla" },
  ],
});

export default config;
