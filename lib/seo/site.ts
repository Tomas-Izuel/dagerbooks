export const SITE_NAME = "DagerBooks";
export const SITE_DESCRIPTION =
  "Mapa de lecturas recomendadas por Dager, organizado por tema y nivel. Proyecto de fans, no oficial.";
export const SITE_LOCALE = "es_AR";

const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const SITE_URL = raw.replace(/\/+$/, "");

export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
export const bookPath = (id: string) => `/libros/${id}`;
export const topicPath = (id: string) => `/temas/${id}`;

export const openLibraryCover = (coverId: number, size: "S" | "M" | "L" = "M") =>
  `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
