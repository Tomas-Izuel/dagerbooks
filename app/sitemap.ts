import type { MetadataRoute } from "next";
import { getBooks, getRoutes, getTopics } from "@/lib/catalog/queries";
import { absoluteUrl, bookPath, topicPath } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/") },
    { url: absoluteUrl("/estaciones") },
    { url: absoluteUrl("/novedades") },
    { url: absoluteUrl("/rutas") },
    ...getRoutes().map((r) => ({ url: absoluteUrl(`/rutas/${r.id}`) })),
    { url: absoluteUrl("/sumar-un-libro") },
    ...getTopics().map((t) => ({ url: absoluteUrl(topicPath(t.id)) })),
    ...getBooks().map((b) => ({ url: absoluteUrl(bookPath(b.id)) })),
  ];
}
