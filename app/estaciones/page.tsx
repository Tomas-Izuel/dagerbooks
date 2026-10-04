import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page/PageShell";
import { LineDisc } from "@/components/ui/LineDisc";
import { loadCatalog } from "@/lib/catalog/load";
import { booksInSector } from "@/lib/catalog/queries";
import { linesFor } from "@/lib/design/lines";
import { bookPath, topicPath } from "@/lib/seo/site";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Directorio de estaciones",
  description: "Las diez líneas de la red de lecturas de Dager y todas sus estaciones, de la zona 1 a la zona 4.",
  alternates: { canonical: "/estaciones" },
};

export default function StationsPage() {
  const { topics, root } = loadCatalog();
  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const lines = linesFor(topics.map((t) => t.id)).map((l) => ({ ...l, name: topicName.get(l.topicId) ?? l.topicId }));

  return (
    <PageShell crumbs={[{ label: "Directorio de estaciones" }]}>
      <section className={styles.directory} aria-labelledby="directorio-titulo">
        <header className={styles.directoryHead}>
          <h1 id="directorio-titulo" className={styles.directoryTitle}>
            Directorio de estaciones
          </h1>
          <p className={styles.directoryLede}>
            Las diez líneas de la red y todas sus estaciones, de la zona 1 a la zona 4. Todo parte de{" "}
            <Link href={bookPath(root.id)}>Kilómetro 0: {root.title}</Link>.
          </p>
        </header>

        <div className={styles.lines}>
          {lines.map((line) => {
            const stations = booksInSector(line.topicId).sort(
              (a, b) => a.level - b.level || a.title.localeCompare(b.title),
            );
            return (
              <section key={line.topicId} className={styles.line} aria-labelledby={`linea-${line.topicId}`}>
                <h3 id={`linea-${line.topicId}`} className={styles.lineHead}>
                  <LineDisc letter={line.letter} color={line.color} size="md" />
                  <Link href={topicPath(line.topicId)} className={styles.lineLink}>
                    {line.name}
                  </Link>
                </h3>
                <ol className={styles.stations}>
                  {stations.map((b) => (
                    <li key={b.id} className={styles.station}>
                      <span className={styles.zone} aria-label={`Zona ${b.level}`}>
                        Z{b.level}
                      </span>
                      <Link href={bookPath(b.id)} className={styles.stationLink}>
                        {b.title}
                      </Link>
                      {b.titleEs ? <span className={styles.stationEs}>{b.titleEs}</span> : null}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
