import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader, type Crumb } from "./SiteHeader";
import styles from "./PageShell.module.css";

/** Marco de las páginas de lectura: cabecera con vuelta al mapa, contenido y pie. */
export function PageShell({ crumbs, children }: { crumbs?: Crumb[]; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <SiteHeader crumbs={crumbs} />
      <main className={styles.main}>{children}</main>
      <SiteFooter />
    </div>
  );
}
