import { OG_CONTENT_TYPE, OG_SIZE, ogHome } from "@/lib/seo/og";

export const alt = "DagerBooks: el mapa de subte con los libros que recomienda Dager, diez líneas que parten de Kilómetro 0";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogHome();
}
