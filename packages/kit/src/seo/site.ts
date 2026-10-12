/** Identidad y URLs absolutas de un sitio. */
export interface SiteInfo {
  name: string;
  description: string;
  /** Locale de Open Graph (es_AR, es_ES…). */
  locale: string;
}

export interface Site extends SiteInfo {
  /** Origen canónico, sin barra final. */
  url: string;
  absoluteUrl(path?: string): string;
}

/**
 * Origen canónico. Orden: NEXT_PUBLIC_SITE_URL explícito, dominio de producción de Vercel,
 * URL del deployment (previews) y, en desarrollo, localhost.
 */
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const raw =
    env.NEXT_PUBLIC_SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function createSite(info: SiteInfo, url = resolveSiteUrl()): Site {
  return {
    ...info,
    url,
    absoluteUrl: (path = "/") => `${url}${path.startsWith("/") ? path : `/${path}`}`,
  };
}

export const openLibraryCover = (coverId: number, size: "S" | "M" | "L" = "M") =>
  `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
