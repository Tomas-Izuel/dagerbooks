import type { Metadata } from "next";
import type { Book, Topic } from "@/lib/catalog/schema";
import { LEVEL_LABELS } from "@/lib/catalog/schema";
import { SITE_LOCALE, SITE_NAME, absoluteUrl, bookPath, topicPath } from "./site";

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function bookMetadata(book: Book): Metadata {
  const by = book.authors?.length ? ` de ${book.authors.join(", ")}` : "";
  const title = `${book.title}${by}`;
  const description = clip(
    book.summary ?? `${book.title}: lectura nivel ${LEVEL_LABELS[book.level].toLowerCase()} recomendada por Dager.`,
  );
  const url = absoluteUrl(bookPath(book.id));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "book", title: `${title} | ${SITE_NAME}`, description, url, siteName: SITE_NAME, locale: SITE_LOCALE },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description },
  };
}

export function topicMetadata(topic: Topic, count: number): Metadata {
  const title = `${topic.name}: ${count} libros`;
  const description = clip(topic.description);
  const url = absoluteUrl(topicPath(topic.id));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: `${title} | ${SITE_NAME}`, description, url, siteName: SITE_NAME, locale: SITE_LOCALE },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description },
  };
}
