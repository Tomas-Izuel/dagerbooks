import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "DagerBooks";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({ title: "El mapa de lecturas", subtitle: "Diez líneas, un solo punto de partida: Kilómetro 0" });
}
