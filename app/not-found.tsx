import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLink } from "@/components/page/ArrowLink";
import { PageShell } from "@/components/page/PageShell";
import { allLines } from "@/components/page/lines";
import { LineDisc } from "@/components/ui/LineDisc";
import { topicPath } from "@/lib/seo/site";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Esta estación no existe",
  robots: { index: false },
};

export default function NotFound() {
  const lines = allLines();
  return (
    <PageShell>
      <section className={styles.wrap} aria-labelledby="nf-title">
        <div className={styles.bar} aria-hidden="true">
          <span className={styles.gap} />
        </div>
        <h1 id="nf-title" className={styles.title}>
          Esta estación no existe
        </h1>
        <p className={styles.text}>
          El tren siguió de largo: la dirección que buscabas no figura en ningún plano. Puede que el libro haya cambiado de nombre, o que
          todavía nadie lo haya sumado.
        </p>
        <div>
          <ArrowLink href="/">Volver al mapa</ArrowLink>
        </div>
        <nav aria-label="Líneas" className={styles.lines}>
          <h2>O subite a una línea</h2>
          <ul>
            {lines.map((l) => (
              <li key={l.topicId}>
                <Link href={topicPath(l.topicId)}>
                  <LineDisc letter={l.letter} color={l.color} size="sm" />
                  <span>{l.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </PageShell>
  );
}
