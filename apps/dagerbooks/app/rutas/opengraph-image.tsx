import { getRoutes } from "@/lib/catalog/queries";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Rutas de lectura de DagerBooks: corrientes y objetivos, de la primera a la última parada";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({ title: "Rutas de lectura", subtitle: `${getRoutes().length} itinerarios para no perderte entre los libros` });
}
