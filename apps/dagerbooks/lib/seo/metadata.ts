import type { Metadata } from "next";
import { pageMetadata } from "@estantes/kit";
import config from "@/creator.config";
import type { Book, Topic } from "@/lib/catalog/schema";
import { LEVEL_LABELS } from "@/lib/labels";
import { bookPath, site, topicPath } from "./site";

export function bookMetadata(book: Book): Metadata {
  const by = book.authors?.length ? ` de ${book.authors.join(", ")}` : "";
  return pageMetadata(site, {
    type: "book",
    title: `${book.title}${by}`,
    description: book.summary ?? config.copy.bookDescriptionFallback(book.title, LEVEL_LABELS[book.level]),
    path: bookPath(book.id),
  });
}

export function topicMetadata(topic: Topic, count: number): Metadata {
  return pageMetadata(site, { title: `${topic.name}: ${count} libros`, description: topic.description, path: topicPath(topic.id) });
}

export function routeMetadata(route: { id: string; name: string; promise: string; steps: unknown[] }): Metadata {
  return pageMetadata(site, {
    title: `${route.name}: ruta de lectura de ${route.steps.length} libros`,
    description: route.promise,
    path: `/rutas/${route.id}`,
  });
}
