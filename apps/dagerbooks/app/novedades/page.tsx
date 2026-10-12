import type { Metadata } from "next";
import Link from "next/link";
import { LineDisc } from "@/components/ui/LineDisc";
import { PageShell } from "@/components/page/PageShell";
import { getUpdates } from "@/lib/catalog/queries";
import { jsonLdString, novedadesJsonLd } from "@/lib/seo";
import { bookPath } from "@/lib/seo/site";
import { formatUpdateDate, updateBooks } from "@/lib/updates";
import styles from "./page.module.css";

/** Con más libros que esto, el resto queda detrás de un <details>. */
const BOOKS_VISIBLE = 6;

export const metadata: Metadata = {
  title: "Novedades",
  description: "Los libros que sumamos al mapa, de qué stream salen y las mejoras del sitio, de la más nueva a la más vieja.",
  alternates: { canonical: "/novedades" },
};

export default function NovedadesPage() {
  const updates = getUpdates();

  return (
    <PageShell crumbs={[{ label: "Novedades" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(novedadesJsonLd(updates)) }} />
      <article className={styles.page}>
        <header className={styles.head}>
          <h1 className={styles.title}>Novedades</h1>
          <p className={styles.lead}>Qué libros sumamos, de qué stream salen y qué mejoramos en el mapa. Lo último, primero.</p>
        </header>

        {updates.length === 0 ? (
          <p className={styles.empty} role="status">
            Todavía no hay novedades. Cuando haya, aparecen acá.
          </p>
        ) : (
          <ol className={styles.route}>
            {updates.map((u, i) => {
              const books = updateBooks(u);
              const shown = books.slice(0, BOOKS_VISIBLE);
              const rest = books.slice(BOOKS_VISIBLE);
              const item = (b: (typeof books)[number]) => (
                <li key={b.book.id} className={styles.book}>
                  {b.line ? <LineDisc letter={b.line.letter} color={b.line.color} size="sm" /> : null}
                  <Link href={bookPath(b.book.id)} className={styles.bookLink}>
                    {b.book.title}
                  </Link>
                  {b.book.titleEs ? <span className={styles.bookEs}>{b.book.titleEs}</span> : null}
                  {b.line ? <span className={styles.srOnly}>. Línea {b.line.letter}: {b.line.name}</span> : null}
                </li>
              );
              return (
                <li key={u.id} className={styles.stop} data-latest={i === 0 ? "true" : undefined}>
                  <h2 className={styles.stopTitle}>
                    <time className={styles.date} dateTime={u.date}>
                      {formatUpdateDate(u.date, "long")}
                    </time>
                    {u.title}
                  </h2>

                  {u.stream ? (
                    <p className={styles.stream}>
                      Del stream{" "}
                      <a href={u.stream.url} target="_blank" rel="noopener noreferrer">
                        {u.stream.title}
                      </a>
                    </p>
                  ) : null}

                  {books.length ? (
                    <section aria-label={`Libros nuevos: ${books.length}`} className={styles.block}>
                      <h3 className={styles.blockTitle}>
                        {books.length} {books.length === 1 ? "libro nuevo" : "libros nuevos"}
                      </h3>
                      <ul className={styles.books}>{shown.map(item)}</ul>
                      {rest.length ? (
                        <details className={styles.more}>
                          <summary>Ver los {rest.length} restantes</summary>
                          <ul className={styles.books}>{rest.map(item)}</ul>
                        </details>
                      ) : null}
                    </section>
                  ) : null}

                  <section aria-label="Mejoras" className={styles.block}>
                    <h3 className={styles.blockTitle}>Qué mejoramos</h3>
                    <ul className={styles.improvements}>
                      {u.improvements.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </section>
                </li>
              );
            })}
          </ol>
        )}
      </article>
    </PageShell>
  );
}
