import { openLibraryCover, type Site } from "./site";

/** Serializa para <script type="application/ld+json">; escapa "<" para evitar cierre de script. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export function websiteJsonLd(site: Site, opts: { language: string; searchPath?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    description: site.description,
    inLanguage: opts.language,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.url}${opts.searchPath ?? "/?q={search_term_string}"}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface JsonLdBook {
  title: string;
  titleEs?: string;
  authors?: readonly string[];
  isbn?: string;
  year?: number;
  summary?: string;
  coverId?: number;
}

export function bookJsonLd(site: Site, book: JsonLdBook, path: string) {
  const sameAs = book.isbn ? [`https://openlibrary.org/isbn/${book.isbn}`] : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    ...(book.titleEs && { alternateName: book.titleEs }),
    url: site.absoluteUrl(path),
    ...(book.authors?.length && { author: book.authors.map((name) => ({ "@type": "Person", name })) }),
    ...(book.isbn && { isbn: book.isbn }),
    ...(book.year && { datePublished: String(book.year) }),
    ...(book.summary && { description: book.summary }),
    ...(book.coverId && { image: openLibraryCover(book.coverId, "L") }),
    ...(sameAs && { sameAs }),
  };
}

export interface JsonLdListItem {
  name: string;
  /** Ruta dentro del sitio (se vuelve absoluta). */
  path?: string;
  description?: string;
}

/** schema.org ItemList. `ordered` agrega itemListOrder ascendente (rutas de lectura). */
export function itemListJsonLd(
  site: Site,
  list: { name: string; path: string; description?: string; ordered?: boolean },
  items: readonly JsonLdListItem[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.name,
    ...(list.description !== undefined && { description: list.description }),
    url: site.absoluteUrl(list.path),
    ...(list.ordered && { itemListOrder: "https://schema.org/ItemListOrderAscending" }),
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      ...(it.path !== undefined && { url: site.absoluteUrl(it.path) }),
      name: it.name,
      ...(it.description !== undefined && { description: it.description }),
    })),
  };
}
