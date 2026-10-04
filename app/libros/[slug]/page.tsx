import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import {
  directPrerequisites,
  directUnlocks,
  getBook,
  getBooks,
  getTopic,
  relatedBooks,
} from "@/lib/catalog/queries";
import { LEVEL_LABELS, RECOMMENDATION_LABELS, type Book } from "@/lib/catalog/schema";
import { bookMetadata } from "@/lib/seo/metadata";
import { bookJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { bookPath, openLibraryCover, topicPath } from "@/lib/seo/site";
import { RecMark } from "@/components/ui/RecMark";
import { LineDisc } from "@/components/ui/LineDisc";
import { AmazonBuy } from "@/components/page/AmazonBuy";
import { ArrowLink } from "@/components/page/ArrowLink";
import { Dotted } from "@/components/page/Dotted";
import { Interchange } from "@/components/page/Interchange";
import { PageShell } from "@/components/page/PageShell";
import { RouteDiagram, type RouteStation } from "@/components/page/RouteDiagram";
import { TrackBand } from "@/components/page/TrackBand";
import { lineInfo } from "@/components/page/lines";
import styles from "./page.module.css";

export const dynamicParams = false;
export const generateStaticParams = () => getBooks().map((b) => ({ slug: b.id }));

type Props = { params: Promise<{ slug: string }> };

const KIND_LABELS: Record<string, string> = {
  book: "Libro",
  essay: "Ensayo",
  paper: "Paper",
  course: "Curso",
  textbook: "Libro de texto",
};

const MISSING_LABELS = {
  authors: "autoría",
  summary: "resumen",
  context: "contexto",
  sources: "fuentes",
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = getBook(slug);
  return book ? bookMetadata(book) : {};
}

const toStation = (b: Book): RouteStation => {
  const l = lineInfo(b.primaryTopic);
  return {
    id: b.id,
    title: b.title,
    href: bookPath(b.id),
    line: l ? { letter: l.letter, color: l.color, name: l.name } : null,
  };
};

/** Prefiere la estación de la misma línea para el cartel de andén. */
const preferSameLine = (books: Book[], topicId: string | null) =>
  books.find((b) => b.primaryTopic === topicId) ?? books[0] ?? null;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  const book = getBook(slug);
  if (!book) notFound();

  const prereqs = directPrerequisites(book.id);
  const unlocks = directUnlocks(book.id);
  const related = relatedBooks(book.id);
  const topics = book.topics.map((id) => getTopic(id)).filter((t) => t !== undefined);
  const sources = book.sources ?? [];

  const line = lineInfo(book.primaryTopic);
  const ink = line?.color ?? "var(--fg)";
  const isRoot = book.level === 0;
  const zoneParts = isRoot ? ["Kilómetro 0"] : [`Zona ${book.level}`, LEVEL_LABELS[book.level]];
  const prev = preferSameLine(prereqs, book.primaryTopic);
  const next = preferSameLine(unlocks, book.primaryTopic);

  return (
    <PageShell
      crumbs={[
        ...(line ? [{ label: `Línea ${line.letter} · ${line.name}`, href: topicPath(line.topicId), line: { letter: line.letter, color: line.color } }] : []),
        { label: book.title },
      ]}
    >
      <article className={styles.article} style={{ "--ink": ink } as CSSProperties}>
        <header className={styles.sign}>
          <TrackBand
            ink={ink}
            prev={prev ? { title: prev.title, href: bookPath(prev.id) } : null}
            here={book.title}
            next={next ? { title: next.title, href: bookPath(next.id) } : null}
            morePrev={Math.max(0, prereqs.length - 1)}
            moreNext={Math.max(0, unlocks.length - 1)}
            prevFallback="Cabecera: acá empieza todo"
            nextFallback="Terminal de la línea"
          />

          <div className={styles.titleRow}>
            <div className={styles.titleBlock}>
              <div className={styles.titleLine}>
                {line ? <LineDisc letter={line.letter} color={line.color} size="lg" label={`Línea ${line.letter}, ${line.name}`} /> : null}
                <h1 className={styles.title}>{book.title}</h1>
              </div>
              {book.titleEs ? (
                <p className={styles.titleEs} lang="es">
                  {book.titleEs}
                </p>
              ) : null}
              <dl className={styles.meta}>
                {book.authors?.length ? (
                  <div>
                    <dt>Autoría</dt>
                    <dd>{book.authors.join(", ")}</dd>
                  </div>
                ) : null}
                {book.year ? (
                  <div>
                    <dt>Año</dt>
                    <dd>{book.year}</dd>
                  </div>
                ) : null}
                {book.kind ? (
                  <div>
                    <dt>Formato</dt>
                    <dd>{KIND_LABELS[book.kind] ?? book.kind}</dd>
                  </div>
                ) : null}
                {!isRoot ? (
                  <div>
                    <dt>Recomendación</dt>
                    <dd className={styles.recValue} title={RECOMMENDATION_LABELS[book.recommendation].description}>
                      <RecMark level={book.recommendation} size={20} />
                      {RECOMMENDATION_LABELS[book.recommendation].label}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Pasaje</dt>
                  <dd>
                      <Dotted parts={zoneParts} />
                    </dd>
                </div>
                {topics.length ? (
                  <div>
                    <dt>{topics.length > 1 ? "Líneas" : "Línea"}</dt>
                    <dd>
                      <ul className={styles.inline}>
                        {topics.map((t) => (
                          <li key={t.id}>
                            <Link href={topicPath(t.id)}>{t.name}</Link>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className={styles.actions}>
                <ArrowLink href={`/?libro=${book.id}`} ink={ink}>
                  Ver en el mapa
                </ArrowLink>
              </div>
              {book.asin ? <AmazonBuy asin={book.asin} title={book.title} /> : null}
            </div>

            {book.coverId ? (
              <figure className={styles.plaque}>
                {/* Plain <img>: next/image would need remotePatterns in next.config.ts. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={openLibraryCover(book.coverId, "M")}
                  alt={`Tapa de ${book.title}`}
                  width={160}
                  height={240}
                  loading="eager"
                  decoding="async"
                />
                <figcaption>Tapa: Open Library</figcaption>
              </figure>
            ) : null}
          </div>
        </header>

        {book.confidence === "low" ? (
          <aside className={styles.notice} aria-label="Estado de la ficha">
            <strong>Por completar</strong>
            <p>
              A esta estación le faltan datos
              {book.missing.length ? `: ${book.missing.map((m) => MISSING_LABELS[m]).join(", ")}` : ""}. Si los tenés,{" "}
              mandá un PR y la terminamos de armar.
            </p>
          </aside>
        ) : null}

        <div className={styles.body}>
          <div className={styles.main}>
            {book.context ? (
              <section aria-labelledby="contexto" className={styles.lead}>
                <h2 id="contexto">Qué dice Dager</h2>
                <p>{book.context}</p>
              </section>
            ) : null}

            {book.summary ? (
              <section aria-labelledby="resumen" className={styles.section}>
                <h2 id="resumen">De qué trata</h2>
                <p>{book.summary}</p>
              </section>
            ) : null}

            {sources.length ? (
              <section aria-labelledby="fuentes" className={styles.section}>
                <h2 id="fuentes">Dónde lo dice</h2>
                <ul className={styles.sources}>
                  {sources.map((s) => (
                    <li key={s.url}>
                      {s.quote ? <blockquote>{s.quote}</blockquote> : null}
                      <a href={s.url} rel="noopener noreferrer" target="_blank">
                        {s.title ?? hostOf(s.url)}
                        {s.timestamp ? <span className={styles.ts}>min {s.timestamp}</span> : null}
                        <span className="sr-only"> (se abre en otra pestaña)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className={styles.side} aria-label="Dónde queda esta estación">
            <section aria-labelledby="recorrido">
              <h2 id="recorrido">Recorrido</h2>
              <RouteDiagram ink={ink} before={prereqs.map(toStation)} here={book.title} after={unlocks.map(toStation)} />
            </section>

            {related.length ? (
              <section aria-labelledby="combinaciones">
                <h2 id="combinaciones">Combinaciones</h2>
                <ul className={styles.interchanges}>
                  {related.map(({ book: r, reason }) => (
                    <li key={r.id}>
                      <Interchange />
                      <div>
                        <Link href={bookPath(r.id)}>{r.title}</Link>
                        <p>{reason}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(bookJsonLd(book)) }} />
    </PageShell>
  );
}
