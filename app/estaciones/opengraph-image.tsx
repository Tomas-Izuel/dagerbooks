import { loadCatalog } from "@/lib/catalog/load";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Directorio de estaciones de DagerBooks: las diez líneas y todos los libros, de la zona 1 a la 4";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  const { books, topics } = loadCatalog();
  return ogImage({ title: "Directorio de estaciones", subtitle: `${books.length} estaciones en ${topics.length} líneas` });
}
