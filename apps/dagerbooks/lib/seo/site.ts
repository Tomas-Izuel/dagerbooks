export const SITE_NAME = "DagerBooks";
export const SITE_DESCRIPTION =
  "Mapa de lecturas recomendadas por Dager, organizado por tema y nivel. Proyecto de fans, no oficial.";
export const SITE_LOCALE = "es_AR";

/**
 * Canonical origin. Order: explicit NEXT_PUBLIC_SITE_URL, Vercel production domain,
 * Vercel deployment URL (previews), then localhost for local dev.
 */
function resolveSiteUrl(): string {
  const env = process.env;
  const raw =
    env.NEXT_PUBLIC_SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
export const SITE_URL = resolveSiteUrl();

export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
export const bookPath = (id: string) => `/libros/${id}`;
export const topicPath = (id: string) => `/temas/${id}`;

export const openLibraryCover = (coverId: number, size: "S" | "M" | "L" = "M") =>
  `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
