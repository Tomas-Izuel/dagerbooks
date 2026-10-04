import type { Book, Topic } from "@/lib/catalog/schema";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl, bookPath, openLibraryCover, topicPath } from "./site";

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "es",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function bookJsonLd(book: Book) {
  const sameAs = book.isbn ? [`https://openlibrary.org/isbn/${book.isbn}`] : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    ...(book.titleEs && { alternateName: book.titleEs }),
    url: absoluteUrl(bookPath(book.id)),
    ...(book.authors?.length && { author: book.authors.map((name) => ({ "@type": "Person", name })) }),
    ...(book.isbn && { isbn: book.isbn }),
    ...(book.year && { datePublished: String(book.year) }),
    ...(book.summary && { description: book.summary }),
    ...(book.coverId && { image: openLibraryCover(book.coverId, "L") }),
    ...(sameAs && { sameAs }),
  };
}

export function topicJsonLd(topic: Topic, books: Book[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: topic.name,
    description: topic.description,
    url: absoluteUrl(topicPath(topic.id)),
    numberOfItems: books.length,
    itemListElement: books.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(bookPath(b.id)),
      name: b.title,
    })),
  };
}

/** Serializa para <script type="application/ld+json">; escapa "<" para evitar cierre de script. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
