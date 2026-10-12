import { Dotted } from "@/components/page/Dotted";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { LineDisc } from "@/components/ui/LineDisc";
import { ArrowLink } from "@/components/page/ArrowLink";
import { PageShell } from "@/components/page/PageShell";
import { lineInfo } from "@/components/page/lines";
import { FollowButton } from "@/components/routes/FollowButton";
import { RouteJourney } from "@/components/routes/RouteJourney";
import { getBook, getRoute, getRoutes } from "@/lib/catalog/queries";
import { ROUTE_KIND_LABELS } from "@/lib/labels";
import { journey } from "@/lib/routes/journey";
import { jsonLdString, routeJsonLd } from "@/lib/seo/jsonld";
import { routeMetadata } from "@/lib/seo/metadata";
import styles from "./page.module.css";

export const dynamicParams = false;
export const generateStaticParams = () => getRoutes().map((r) => ({ slug: r.id }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const route = getRoute(slug);
  return route ? routeMetadata(route) : {};
}

export default async function RoutePage({ params }: Props) {
  const { slug } = await params;
  const route = getRoute(slug);
  if (!route) notFound();
  const line = lineInfo(route.line)!;
  const { stops, order } = journey(route);
  const first = getBook(route.steps[0].book)!;
  const knownIds = getRoutes().map((r) => r.id);

  return (
    <PageShell
      crumbs={[
        { label: "Rutas", href: "/rutas" },
        { label: route.name, line: { letter: line.letter, color: line.color } },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(routeJsonLd(route)) }} />
      <div className={styles.page} style={{ "--ink": line.color } as CSSProperties}>
        <header className={styles.head}>
          <div className={styles.titleLine}>
            <LineDisc letter={line.letter} color={line.color} size="lg" label={`Línea ${line.letter}, ${line.name}`} />
            <h1 className={styles.title}>{route.name}</h1>
          </div>
          <p className={styles.meta}>
            <span className={styles.kind}>{ROUTE_KIND_LABELS[route.kind]}</span>
            <span>
              <Dotted parts={[`${route.steps.length} libros`, `Arranca en ${first.title}`]} />
            </span>
          </p>
          <p className={styles.promise}>{route.promise}</p>
          <details className={styles.more}>
            <summary className={styles.moreSummary}>De qué va</summary>
            <p className={styles.summary}>{route.summary}</p>
            {order ? (
              <p className={styles.order}>
                <strong>El orden lo marcó Dager:</strong> «{order.quote}»{" "}
                <a href={order.url} target="_blank" rel="noopener noreferrer">
                  {order.linkLabel}
                </a>
              </p>
            ) : null}
          </details>
          <div className={styles.actions}>
            <FollowButton routeId={route.id} knownIds={knownIds} />
            <ArrowLink href={`/?ruta=${route.id}`} variant="ghost">
              Ver en el mapa
            </ArrowLink>
          </div>
        </header>

        <RouteJourney routeId={route.id} routeName={route.name} stops={stops} />
      </div>
    </PageShell>
  );
}
