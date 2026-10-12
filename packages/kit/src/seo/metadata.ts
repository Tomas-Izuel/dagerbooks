import type { Site } from "./site";

/** Recorta a `n` caracteres con elipsis (para descriptions). */
export const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Metadata de una página (forma compatible con `Metadata` de Next): canonical, Open Graph y Twitter.
 * Los textos los arma la app.
 */
export function pageMetadata(site: Site, page: { title: string; description: string; path: string; type?: "website" | "book" | "article" }) {
  const url = site.absoluteUrl(page.path);
  const description = clip(page.description);
  const full = `${page.title} | ${site.name}`;
  return {
    title: page.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: page.type ?? "website", title: full, description, url, siteName: site.name, locale: site.locale },
    twitter: { card: "summary_large_image" as const, title: full, description },
  };
}
