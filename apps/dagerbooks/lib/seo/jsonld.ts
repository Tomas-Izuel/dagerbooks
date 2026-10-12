import { bookJsonLd as kitBookJsonLd, itemListJsonLd, websiteJsonLd as kitWebsiteJsonLd } from "@estantes/kit";
import { getBook } from "@/lib/catalog/queries";
import type { Book, Route, SiteUpdate, Topic } from "@/lib/catalog/schema";
import { SITE_NAME, bookPath, site, topicPath } from "./site";

export { jsonLdString } from "@estantes/kit";

export const websiteJsonLd = () => kitWebsiteJsonLd(site, { language: "es" });

export const bookJsonLd = (book: Book) => kitBookJsonLd(site, book, bookPath(book.id));

export const topicJsonLd = (topic: Topic, books: Book[]) =>
  itemListJsonLd(
    site,
    { name: topic.name, description: topic.description, path: topicPath(topic.id) },
    books.map((b) => ({ path: bookPath(b.id), name: b.title })),
  );

export const novedadesJsonLd = (updates: SiteUpdate[]) =>
  itemListJsonLd(
    site,
    { name: `Novedades de ${SITE_NAME}`, path: "/novedades" },
    updates.map((u) => ({ name: u.title, description: u.improvements.join(" ") })),
  );

export const routePath = (id: string) => `/rutas/${id}`;

export const routeJsonLd = (route: Route) =>
  itemListJsonLd(
    site,
    { name: route.name, description: route.promise, path: routePath(route.id), ordered: true },
    route.steps.map((s) => ({ path: bookPath(s.book), name: getBook(s.book)?.title ?? s.book })),
  );

export const routesJsonLd = (routes: Route[]) =>
  itemListJsonLd(
    site,
    { name: `Rutas de lectura de ${SITE_NAME}`, path: "/rutas" },
    routes.map((r) => ({ path: routePath(r.id), name: r.name, description: r.promise })),
  );
