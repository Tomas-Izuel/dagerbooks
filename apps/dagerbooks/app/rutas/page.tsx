import { Dotted } from "@/components/page/Dotted";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { PageShell } from "@/components/page/PageShell";
import { LineDisc } from "@/components/ui/LineDisc";
import { RouteStatus } from "@/components/routes/RouteStatus";
import { RouteStrip } from "@/components/routes/RouteStrip";
import { getRoutes } from "@/lib/catalog/queries";
import { ROUTE_KINDS, type RouteKind } from "@/lib/catalog/schema";
import { ROUTE_KIND_LABELS } from "@/lib/labels";
import { routeSummaries } from "@/lib/routes/summary";
import { jsonLdString, routePath, routesJsonLd } from "@/lib/seo/jsonld";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Rutas de lectura",
  description: "Itinerarios curados para no perderte entre los libros: corrientes de pensamiento y objetivos concretos, parada por parada.",
  alternates: { canonical: "/rutas" },
};

const GROUPS: Record<RouteKind, { title: string; lead: string }> = {
  corriente: { title: "Corrientes", lead: "Una escuela de pensamiento, de sus bases a sus fuentes." },
  objetivo: { title: "Objetivos", lead: "Algo concreto que querés poder hacer al final." },
};

export default function RutasPage() {
  const routes = routeSummaries();
  const knownIds = getRoutes().map((r) => r.id);

  return (
    <PageShell crumbs={[{ label: "Rutas" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(routesJsonLd(getRoutes())) }} />
      <article className={styles.page}>
        <header className={styles.head}>
          <h1 className={styles.title}>Rutas</h1>
          <p className={styles.lead}>
            Itinerarios de lectura para quien no sabe por dónde arrancar. Cada ruta cruza líneas del mapa y te dice qué leer primero, qué
            sigue y por qué. Podés seguir varias a la vez.
          </p>
        </header>

        {routes.length === 0 ? (
          <p className={styles.empty} role="status">
            Todavía no hay rutas. Mientras tanto, elegí una línea en el mapa.
          </p>
        ) : (
          ROUTE_KINDS.map((kind) => {
            const group = routes.filter((r) => r.kind === kind);
            if (group.length === 0) return null;
            return (
              <section key={kind} className={styles.group} aria-labelledby={`grupo-${kind}`}>
                <div className={styles.groupHead}>
                  <h2 id={`grupo-${kind}`} className={styles.groupTitle}>
                    {GROUPS[kind].title}
                  </h2>
                  <p className={styles.groupLead}>{GROUPS[kind].lead}</p>
                </div>
                <ul className={styles.list}>
                  {group.map((r) => (
                    <li key={r.id} className={styles.row} style={{ "--ink": r.line.color } as CSSProperties}>
                      <LineDisc letter={r.line.letter} color={r.line.color} size="lg" label={`Línea ${r.line.letter}, ${r.line.name}`} />
                      <div className={styles.text}>
                        <h3 className={styles.name}>
                          <Link href={routePath(r.id)} className={styles.link}>
                            {r.name}
                          </Link>
                        </h3>
                        <p className={styles.promise}>{r.promise}</p>
                        <RouteStrip route={r} />
                        <p className={styles.meta}>
                          <Dotted parts={[`${r.steps.length} libros`, ROUTE_KIND_LABELS[r.kind], `Primera estación: ${r.steps[0].title}`]} />
                        </p>
                        <RouteStatus route={r} knownIds={knownIds} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </article>
    </PageShell>
  );
}
