import { booksInTopic, getTopic, getTopics } from "@/lib/catalog/queries";
import { linesFor } from "@/lib/design/lines";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Línea de subte de DagerBooks: un tema con sus estaciones, de la zona 1 a la 4";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamicParams = false;

export const generateStaticParams = () => getTopics().map((t) => ({ slug: t.id }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  const n = booksInTopic(slug).length;
  const letter = linesFor(getTopics().map((t) => t.id)).find((l) => l.topicId === slug)?.letter;
  return ogImage({
    title: topic?.name ?? "Tema",
    subtitle: `${letter ? `Línea ${letter} · ` : ""}${n} ${n === 1 ? "estación" : "estaciones"}`,
    topicId: topic?.id,
  });
}
