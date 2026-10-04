import { booksInTopic, getTopic, getTopics } from "@/lib/catalog/queries";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og";

export const alt = "Tema en DagerBooks";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamicParams = false;

export const generateStaticParams = () => getTopics().map((t) => ({ slug: t.id }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  return ogImage({ title: topic?.name ?? "Tema", subtitle: `${booksInTopic(slug).length} estaciones en la línea`, topicId: topic?.id });
}
