import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Sumar un libro a DagerBooks: cómo proponer una estación nueva en el mapa";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({ title: "Sumá un libro a la red", subtitle: "Una estación nueva, por pull request" });
}
