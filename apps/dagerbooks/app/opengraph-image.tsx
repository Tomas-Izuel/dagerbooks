import { loadCatalog } from "@/lib/catalog/load";
import { numberInWords } from "@/lib/design/numbers";
import { OG_CONTENT_TYPE, OG_SIZE, ogHome } from "@/lib/seo/og";

export const alt = `DagerBooks: el mapa de subte con los libros que recomienda Dager, ${numberInWords(loadCatalog().topics.length)} líneas que parten de Kilómetro 0`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogHome();
}
