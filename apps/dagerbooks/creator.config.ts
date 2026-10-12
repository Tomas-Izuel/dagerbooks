/**
 * Todo lo propio de Dager que no es UI: identidad del sitio, etiquetas de los datos,
 * afiliado, módulos del catálogo y fuentes de ingesta. Los paquetes compartidos no
 * conocen nada de esto; lo reciben desde acá.
 */

import { defineCreator } from "@estantes/kit";

const config = defineCreator({
  id: "dagerbooks",
  name: "Dager",
  bio: "Dager (Mariano Villa), programador y streamer argentino que habla de programación, filosofía, economía e historia",
  standard:
    "Cada libro y cada paso se tiene que poder defender si alguien se lo muestra a Dager. No inventes lo que no dijo: si le atribuís algo, tiene que estar en la cita. Las citas son textuales y el link lleva &t= con el segundo exacto.",
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
