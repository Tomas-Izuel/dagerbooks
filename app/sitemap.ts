import type { MetadataRoute } from "next";
import { getBooks, getTopics } from "@/lib/catalog/queries";
import { absoluteUrl, bookPath, topicPath } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/") },
    { url: absoluteUrl("/estaciones") },
    { url: absoluteUrl("/sumar-un-libro") },
    ...getTopics().map((t) => ({ url: absoluteUrl(topicPath(t.id)) })),
    ...getBooks().map((b) => ({ url: absoluteUrl(bookPath(b.id)) })),
  ];
}
