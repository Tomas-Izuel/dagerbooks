import { getBook, getBooks } from "@/lib/catalog/queries";
import { LEVEL_LABELS } from "@/lib/catalog/schema";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Ficha del libro en DagerBooks: título, autor, zona y la línea de subte a la que pertenece";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamicParams = false;

export const generateStaticParams = () => getBooks().map((b) => ({ slug: b.id }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = getBook(slug);
  const zone = book ? (book.level === 0 ? "Kilómetro 0" : `Zona ${book.level} · ${LEVEL_LABELS[book.level]}`) : undefined;
  const by = book?.authors?.join(", ");
  return ogImage({ title: book?.title ?? "Libro", subtitle: [by, zone].filter(Boolean).join(" · ") || undefined, topicId: book?.primaryTopic, coverId: book?.coverId });
}
