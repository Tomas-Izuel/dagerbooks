import Link from "next/link";
import { CONTRIBUTE_LABEL } from "./constants";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.notice}>
          DagerBooks es un proyecto de fans y no es oficial: ni Dager ni su comunidad lo respaldan. Las recomendaciones salen de lo que
          él dijo; los errores son nuestros.
        </p>
        <ul className={styles.links}>
          <li>
            <Link href="/sumar-un-libro">{CONTRIBUTE_LABEL}</Link>
          </li>
          <li>
            Tapas de{" "}
            <a href="https://openlibrary.org" rel="noopener noreferrer" target="_blank">
              Open Library
            </a>
          </li>
        </ul>
        <p className={styles.credit}>Hecho por Tomas Izuel</p>
      </div>
    </footer>
  );
}
