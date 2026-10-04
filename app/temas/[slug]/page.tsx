import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { booksInTopic, getBook, getRoot, getTopic, getTopics, isEntryPoint } from "@/lib/catalog/queries";
import { LEVEL_LABELS, type Book } from "@/lib/catalog/schema";
import { topicMetadata } from "@/lib/seo/metadata";
import { jsonLdString, topicJsonLd } from "@/lib/seo/jsonld";
import { bookPath } from "@/lib/seo/site";
import { LineDisc } from "@/components/ui/LineDisc";
import { ArrowLink } from "@/components/page/ArrowLink";
import { Dotted } from "@/components/page/Dotted";
import { PageShell } from "@/components/page/PageShell";
import { lineInfo } from "@/components/page/lines";
import styles from "./page.module.css";

export const dynamicParams = false;
export const generateStaticParams = () => getTopics().map((t) => ({ slug: t.id }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopic(slug);
  return topic ? topicMetadata(topic, booksInTopic(slug).length) : {};
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();
  const line = lineInfo(slug)!;
  const root = getRoot();
  const books = booksInTopic(slug);
  const inLine = new Set(books.map((b) => b.id));

  const zones = [1, 2, 3, 4]
    .map((level) => ({
      level,
      books: books
        .filter((b) => b.level === level)
        .sort((a, b) => Number(isEntryPoint(b.id)) - Number(isEntryPoint(a.id)) || a.title.localeCompare(b.title)),
    }))
    .filter((z) => z.books.length);

  /** Estaciones de esta línea a las que bifurca un libro (más de una = punto de bifurcación). */
  const forksOf = (b: Book) => (b.leadsTo ?? []).filter((id) => inLine.has(id)).map((id) => getBook(id)!);

  return (
    <PageShell crumbs={[{ label: `Línea ${line.letter} · ${topic.name}`, line: { letter: line.letter, color: line.color } }]}>
      <div className={styles.page} style={{ "--ink": line.color } as CSSProperties}>
        <header className={styles.sign}>
          <div className={styles.bar} aria-hidden="true" />
          <div className={styles.titleLine}>
            <LineDisc letter={line.letter} color={line.color} size="lg" label={`Línea ${line.letter}`} />
            <h1 className={styles.title}>{topic.name}</h1>
          </div>
          <p className={styles.desc}>{topic.description}</p>
          <p className={styles.count}>
            {books.length} {books.length === 1 ? "estación" : "estaciones"}
          </p>
          <div>
            <ArrowLink href={`/?tema=${topic.id}`} ink={line.color}>
              Ver la línea en el mapa
            </ArrowLink>
          </div>
        </header>

        {zones.length === 0 ? (
          <p className={styles.empty}>Esta línea todavía no tiene estaciones. Cuando haya libros, van a aparecer acá.</p>
        ) : (
          <section aria-labelledby="recorrido" className={styles.stripWrap}>
            <h2 id="recorrido" className="sr-only">
              Estaciones de la línea, de la cabecera al final
            </h2>
            <div className={styles.strip}>
              <div className={styles.km}>
                <span className={styles.ring} data-km="" aria-hidden="true" />
                <Link href={bookPath(root.id)}>
                  <strong>Kilómetro 0</strong> {root.title}
                </Link>
              </div>

              {zones.map((z) => {
                const branch = z.books.length > 1;
                return (
                  <section key={z.level} className={styles.zone} data-branch={branch ? "" : undefined} aria-labelledby={`zona-${z.level}`}>
                    <h3 id={`zona-${z.level}`} className={styles.zoneSign}>
                      <Dotted parts={[`Zona ${z.level}`, LEVEL_LABELS[z.level]]} />
                    </h3>
                    <ol className={styles.stations}>
                      {z.books.map((b) => {
                        const forks = forksOf(b);
                        const other = b.primaryTopic && b.primaryTopic !== slug ? lineInfo(b.primaryTopic) : null;
                        return (
                          <li key={b.id} className={styles.station}>
                            <span className={styles.ring} aria-hidden="true" />
                            <div className={styles.stationBody}>
                              <div className={styles.stationHead}>
                                <Link href={bookPath(b.id)} className={styles.stationName}>
                                  {b.title}
                                </Link>
                                {isEntryPoint(b.id) ? <span className={styles.tag}>Cabecera</span> : null}
                                {b.confidence === "low" ? <span className={styles.tag} data-tone="todo">Por completar</span> : null}
                              </div>
                              {b.titleEs ? <p className={styles.sub}>{b.titleEs}</p> : null}
                              {b.authors?.length ? <p className={styles.sub}>{b.authors.join(", ")}</p> : null}
                              {other ? (
                                <p className={styles.sub}>
                                  <LineDisc letter={other.letter} color={other.color} size="sm" /> Combina con la línea {other.letter}, {other.name}
                                </p>
                              ) : null}
                              {forks.length > 1 ? (
                                <p className={styles.fork}>
                                  Bifurca: seguís por {forks.map((f, i) => (
                                    <span key={f.id}>
                                      {i > 0 ? (i === forks.length - 1 ? " o " : ", ") : ""}
                                      <Link href={bookPath(f.id)}>{f.title}</Link>
                                    </span>
                                  ))}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
            </div>
          </section>
        )}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(topicJsonLd(topic, books)) }} />
    </PageShell>
  );
}
