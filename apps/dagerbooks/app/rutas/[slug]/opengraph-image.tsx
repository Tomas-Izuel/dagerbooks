import { getRoute, getRoutes } from "@/lib/catalog/queries";
import { ROUTE_KIND_LABELS } from "@/lib/catalog/schema";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Ruta de lectura de DagerBooks: un itinerario de libros como una línea de subte";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamicParams = false;

export const generateStaticParams = () => getRoutes().map((r) => ({ slug: r.id }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const route = getRoute(slug);
  return ogImage({
    title: route?.name ?? "Ruta",
    subtitle: route ? `${ROUTE_KIND_LABELS[route.kind]} · ${route.steps.length} libros` : undefined,
    topicId: route?.line,
  });
}
