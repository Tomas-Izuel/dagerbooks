import { getUpdates } from "@/lib/catalog/queries";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Novedades de DagerBooks: libros nuevos, streams y mejoras del mapa";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  const [latest] = getUpdates();
  return ogImage({ title: "Novedades", subtitle: latest ? latest.title : "Libros nuevos y mejoras del mapa" });
}
